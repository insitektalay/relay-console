import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class SignRequestApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SignRequestApiAdapter {
  private readonly apiOrigin = "https://signrequest.com";

  async health(accessToken: string) {
    await this.request(accessToken, "/api/v1/documents/?limit=1");
    return {
      readScopeVerified: true,
      providerRequestCount: 1,
      writesEnabled: false,
    };
  }

  async listDocuments(accessToken: string, input: JsonObject) {
    const resultLimit = this.resultLimit(input.resultLimit);
    const value = await this.request(
      accessToken,
      `/api/v1/documents/?limit=${resultLimit}`,
    );
    const documents = this.array(value.results)
      .slice(0, resultLimit)
      .map((entry) => this.summary(this.object(entry)));
    return {
      semanticReadContract: "signrequest-document-list-v1",
      documents,
      resultCount: documents.length,
      maxResults: resultLimit,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getDocument(accessToken: string, input: JsonObject) {
    const documentUuid = this.documentUuid(input.documentUuid);
    const value = await this.request(
      accessToken,
      `/api/v1/documents/${documentUuid}/`,
    );
    return {
      semanticReadContract: "signrequest-document-get-v1",
      document: this.summary(value),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async request(accessToken: string, target: string) {
    if (!accessToken || accessToken.length > 10_000)
      throw new SignRequestApiError(
        "credential_missing",
        "SignRequest access token is missing.",
        401,
      );
    const url = new URL(target, `${this.apiOrigin}/`);
    const validList =
      url.pathname === "/api/v1/documents/" &&
      [...url.searchParams.keys()].every((key) => key === "limit") &&
      url.searchParams.has("limit");
    const validGet =
      /^\/api\/v1\/documents\/[0-9a-f-]{36}\/$/.test(url.pathname) &&
      !url.search;
    if (url.origin !== this.apiOrigin || url.hash || !(validList || validGet))
      throw new SignRequestApiError(
        "policy_blocked",
        "SignRequest request escaped Relay's fixed read-only route allowlist.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new SignRequestApiError(
        "provider_unavailable",
        "SignRequest could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation(
        "SignRequest response exceeded Relay's 1 MB bound.",
      );
    let value: JsonObject;
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw this.validation("SignRequest returned invalid JSON.");
    }
    if (!response.ok)
      throw new SignRequestApiError(
        this.errorCode(response.status),
        "SignRequest rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private summary(value: JsonObject) {
    return {
      documentUuid: this.uuid(value.uuid),
      name: this.scalar(value.name, 255),
      status: this.scalar(value.status, 64),
      processing:
        typeof value.processing === "boolean" ? value.processing : null,
      createdAt: this.timestamp(value.created),
      modifiedAt: this.timestamp(value.modified),
      autoDeleteAfter: this.timestamp(value.auto_delete_after),
    };
  }

  private boundary() {
    return {
      exactReadScope: true,
      writesEnabled: false,
      peopleReturned: false,
      teamDataReturned: false,
      documentContentReturned: false,
      signingDataReturned: false,
      auditTrailReturned: false,
      rawProviderToolExposure: false,
      automaticPagination: false,
      automaticRetries: false,
      redactionStatus:
        "people-teams-content-signing-audit-writes-broader-authority-raw-excluded",
    };
  }
  private resultLimit(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw this.validation("resultLimit must be an integer from 1 to 25.");
    return Number(value);
  }
  private documentUuid(value: unknown) {
    const uuid = this.uuid(value);
    if (!uuid) throw this.validation("documentUuid is invalid.");
    return uuid;
  }
  private uuid(value: unknown) {
    return typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value.toLowerCase()
      : null;
  }
  private timestamp(value: unknown) {
    return typeof value === "string" &&
      value.length <= 64 &&
      !Number.isNaN(Date.parse(value))
      ? value
      : null;
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new SignRequestApiError("provider_validation_error", message);
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }
}
