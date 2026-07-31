import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;

export class SigneasyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SigneasyApiAdapter {
  private readonly origin = "https://api.signeasy.com";
  async health(token: string) {
    await this.request(token, "/v3/rs/");
    return {
      pendingEnvelopeReadVerified: true,
      providerRequestCount: 1,
      writesEnabled: false,
    };
  }
  async listEnvelopes(token: string, input: JsonObject) {
    const limit = this.limit(input.resultLimit);
    const value = await this.request(token, "/v3/rs/");
    const source = this.array(value.data).length
      ? this.array(value.data)
      : this.array(value.results).length
        ? this.array(value.results)
        : this.array(value.pending_files);
    const envelopes = source
      .slice(0, limit)
      .map((entry) => this.summary(this.object(entry)));
    return {
      semanticReadContract: "signeasy-envelope-list-v1",
      envelopes,
      resultCount: envelopes.length,
      maxResults: limit,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }
  async getEnvelope(token: string, input: JsonObject) {
    const id = this.id(input.envelopeId);
    const value = await this.request(token, `/v3/rs/${id}`);
    return {
      semanticReadContract: "signeasy-envelope-get-v1",
      envelope: this.summary(value),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }
  private async request(token: string, target: string) {
    if (!token || token.length > 10_000)
      throw new SigneasyApiError(
        "credential_missing",
        "Signeasy access token is missing.",
        401,
      );
    const url = new URL(target, `${this.origin}/`);
    const allowed =
      (url.pathname === "/v3/rs/" ||
        /^\/v3\/rs\/[1-9][0-9]{0,9}$/.test(url.pathname)) &&
      !url.search;
    if (url.origin !== this.origin || url.hash || !allowed)
      throw new SigneasyApiError(
        "policy_blocked",
        "Signeasy request escaped Relay's fixed read-only route allowlist.",
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
      throw new SigneasyApiError(
        "provider_unavailable",
        "Signeasy could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Signeasy response exceeded Relay's 1 MB bound.");
    let value: JsonObject;
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw this.validation("Signeasy returned invalid JSON.");
    }
    if (!response.ok)
      throw new SigneasyApiError(
        this.errorCode(response.status),
        "Signeasy rejected the bounded request.",
        response.status,
      );
    return value;
  }
  private summary(value: JsonObject) {
    return {
      envelopeId: this.integer(value.id ?? value.pending_file_id),
      name: this.scalar(value.name ?? value.title, 512),
      status: this.scalar(value.status, 96),
      createdAt: this.timestamp(value.created_at ?? value.created_time),
      updatedAt: this.timestamp(value.updated_at ?? value.last_modified_time),
      expiresAt: this.timestamp(value.expires_at ?? value.expiry_time),
    };
  }
  private boundary() {
    return {
      exactScopes: ["rs:read", "offline_access"],
      writesEnabled: false,
      peopleReturned: false,
      filesReturned: false,
      signingUrlsReturned: false,
      auditTrailReturned: false,
      rawProviderToolExposure: false,
      automaticPagination: false,
      automaticRetries: false,
      redactionStatus:
        "people-files-signing-audit-writes-broader-authority-raw-excluded",
    };
  }
  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw this.validation("resultLimit must be an integer from 1 to 25.");
    return Number(value);
  }
  private id(value: unknown) {
    if (
      !Number.isInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 2147483647
    )
      throw this.validation("envelopeId is invalid.");
    return Number(value);
  }
  private integer(value: unknown) {
    return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
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
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new SigneasyApiError("provider_validation_error", message);
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
