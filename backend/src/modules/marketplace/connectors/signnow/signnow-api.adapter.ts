import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class SignNowApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SignNowApiAdapter {
  private readonly apiOrigin = "https://api.signnow.com";

  async health(accessToken: string) {
    const value = await this.request(accessToken, "/user");
    const userId = this.identifier(value.id ?? value.user_id);
    if (!userId)
      throw this.validation(
        "SignNow did not return a stable connected user ID.",
      );
    return { userId, providerRequestCount: 1, writesEnabled: false };
  }

  async listDocuments(accessToken: string, input: JsonObject) {
    const resultLimit = this.resultLimit(input.resultLimit);
    const value = await this.request(accessToken, "/user/documentsv2");
    const documents = this.array(value.documents)
      .slice(0, resultLimit)
      .map((entry) => this.summary(this.object(entry)));
    return {
      semanticReadContract: "signnow-document-list-v1",
      documents,
      resultCount: documents.length,
      maxResults: resultLimit,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getDocument(accessToken: string, input: JsonObject) {
    const documentId = this.documentId(input.documentId);
    const value = await this.request(
      accessToken,
      `/document/${encodeURIComponent(documentId)}`,
    );
    return {
      semanticReadContract: "signnow-document-get-v1",
      document: this.summary(value),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async request(accessToken: string, target: string) {
    if (!accessToken || accessToken.length > 10_000)
      throw new SignNowApiError(
        "credential_missing",
        "SignNow access token is missing.",
        401,
      );
    const url = new URL(target, `${this.apiOrigin}/`);
    const validList = url.pathname === "/user/documentsv2" && !url.search;
    const validGet =
      /^\/document\/[^/]{1,384}$/.test(url.pathname) && !url.search;
    const validHealth = url.pathname === "/user" && !url.search;
    if (
      url.origin !== this.apiOrigin ||
      url.hash ||
      !(validList || validGet || validHealth)
    )
      throw new SignNowApiError(
        "policy_blocked",
        "SignNow request escaped Relay's fixed read-only route allowlist.",
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
      throw new SignNowApiError(
        "provider_unavailable",
        "SignNow could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("SignNow response exceeded Relay's 1 MB bound.");
    let value: JsonObject;
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw this.validation("SignNow returned invalid JSON.");
    }
    if (!response.ok)
      throw new SignNowApiError(
        this.errorCode(response.status),
        "SignNow rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private summary(value: JsonObject) {
    return {
      documentId: this.identifier(value.id ?? value.document_id),
      name: this.scalar(value.document_name ?? value.name, 512),
      status: this.scalar(value.document_status ?? value.status, 96),
      pageCount: this.integer(value.page_count ?? value.pages_count),
      createdAt: this.timestamp(value.created ?? value.created_at),
      updatedAt: this.timestamp(value.updated ?? value.updated_at),
      versionAt: this.timestamp(value.version_time),
      template: this.boolean(value.template ?? value.is_template),
    };
  }

  private boundary() {
    return {
      providerScope: "*",
      providerScopeIsBroad: true,
      relayReadOnlyProjection: true,
      writesEnabled: false,
      participantIdentityReturned: false,
      documentContentReturned: false,
      signingSurfacesReturned: false,
      auditTrailReturned: false,
      rawProviderToolExposure: false,
      automaticPagination: false,
      automaticRetries: false,
      redactionStatus:
        "people-content-signing-audit-writes-broad-authority-raw-excluded",
    };
  }

  private resultLimit(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw this.validation("resultLimit must be an integer from 1 to 25.");
    return Number(value);
  }

  private documentId(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
      throw this.validation("documentId is invalid.");
    return value;
  }

  private identifier(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(value)
      ? value
      : null;
  }

  private timestamp(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      return value;
    return typeof value === "string" && value.length <= 64 ? value : null;
  }

  private integer(value: unknown) {
    return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
  }

  private boolean(value: unknown) {
    return typeof value === "boolean"
      ? value
      : value === "1"
        ? true
        : value === "0"
          ? false
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
    return new SignNowApiError("provider_validation_error", message);
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
