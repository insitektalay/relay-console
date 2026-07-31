import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class RightSignatureApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class RightSignatureApiAdapter {
  private readonly origin = "https://api.rightsignature.com";

  async health(token: string) {
    await this.request(
      token,
      "/public/v2/documents?per_page=1&page=1&state=pending",
    );
    return {
      documentReadVerified: true,
      providerRequestCount: 1,
      exactScopes: ["read"],
      writesEnabled: false,
    };
  }

  async listDocuments(token: string, input: JsonObject) {
    const state = this.state(input.state);
    const limit = this.limit(input.resultLimit);
    const query = new URLSearchParams({
      per_page: String(limit),
      page: "1",
      state,
    });
    const value = await this.request(token, `/public/v2/documents?${query}`);
    const documents = this.array(value.documents)
      .slice(0, limit)
      .map((entry) => this.summary(this.object(entry)));
    return {
      semanticReadContract: "rightsignature-document-list-v1",
      documents,
      resultCount: documents.length,
      maxResults: limit,
      state,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getDocument(token: string, input: JsonObject) {
    const id = this.id(input.documentId);
    const value = await this.request(token, `/public/v2/documents/${id}`);
    return {
      semanticReadContract: "rightsignature-document-get-v1",
      document: this.summary(this.object(value.document)),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async request(token: string, target: string) {
    if (!token || token.length > 10_000)
      throw new RightSignatureApiError(
        "credential_missing",
        "RightSignature access token is missing.",
        401,
      );
    const url = new URL(target, `${this.origin}/`);
    const listAllowed =
      url.pathname === "/public/v2/documents" &&
      [...url.searchParams.keys()].every((key) =>
        ["per_page", "page", "state"].includes(key),
      );
    const getAllowed =
      /^\/public\/v2\/documents\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        url.pathname,
      ) && !url.search;
    if (url.origin !== this.origin || url.hash || (!listAllowed && !getAllowed))
      throw new RightSignatureApiError(
        "policy_blocked",
        "RightSignature request escaped Relay's fixed read-only route allowlist.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new RightSignatureApiError(
        "provider_unavailable",
        "RightSignature could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation(
        "RightSignature response exceeded Relay's 1 MB bound.",
      );
    let value: JsonObject;
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw this.validation("RightSignature returned invalid JSON.");
    }
    if (!response.ok)
      throw new RightSignatureApiError(
        this.errorCode(response.status),
        "RightSignature rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private summary(value: JsonObject) {
    return {
      documentId: this.uuidOrNull(value.id),
      name: this.scalar(value.name, 512),
      state: this.scalar(value.state, 64),
      createdAt: this.timestamp(value.created_at),
      updatedAt: this.timestamp(value.updated_at),
      sentAt: this.timestamp(value.sent_at),
      executedAt: this.timestamp(value.executed_at),
      expiredAt: this.timestamp(value.expired_at),
      declinedAt: this.timestamp(value.declined_at),
      voidedAt: this.timestamp(value.voided_at),
    };
  }
  private boundary() {
    return {
      exactScopes: ["read"],
      writesEnabled: false,
      peopleReturned: false,
      filenamesReturned: false,
      documentsReturned: false,
      signingUrlsReturned: false,
      certificatesReturned: false,
      formFieldsReturned: false,
      rawProviderToolExposure: false,
      automaticPagination: false,
      automaticRetries: false,
      redactionStatus:
        "people-files-signing-fields-certificates-writes-broader-authority-raw-excluded",
    };
  }
  private state(value: unknown) {
    if (
      typeof value !== "string" ||
      !new Set([
        "draft",
        "pending",
        "executed",
        "voided",
        "expired",
        "declined",
        "editing",
      ]).has(value)
    )
      throw this.validation("state is invalid.");
    return value;
  }
  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw this.validation("resultLimit must be an integer from 1 to 25.");
    return Number(value);
  }
  private id(value: unknown) {
    if (typeof value !== "string" || !this.isUuid(value))
      throw this.validation("documentId is invalid.");
    return value.toLowerCase();
  }
  private uuidOrNull(value: unknown) {
    return typeof value === "string" && this.isUuid(value)
      ? value.toLowerCase()
      : null;
  }
  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }
  private timestamp(value: unknown) {
    return (typeof value === "string" && value.length <= 64) ||
      (typeof value === "number" && Number.isFinite(value))
      ? value
      : null;
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 400) return "insufficient_scope";
    if (status === 404 || status === 422) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new RightSignatureApiError("provider_validation_error", message);
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
}
