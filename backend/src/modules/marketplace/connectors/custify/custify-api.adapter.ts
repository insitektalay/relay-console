import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type CustifyCredentials = { apiKey: string; apiOrigin: string };

export class CustifyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class CustifyApiAdapter {
  private static readonly path = "/segment";
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: CustifyCredentials) {
    await this.fetchSegments(credentials, 1, "company");
    return {
      credentialsVerified: true,
      exactOriginBound: true,
      segmentDataReturned: false,
      customerDataReturned: false,
      writesEnabled: false,
    };
  }

  async listSegments(credentials: CustifyCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const type = this.type(input.type);
    const value = this.object(
      await this.fetchSegments(credentials, limit, type),
    );
    if (!Array.isArray(value.segments))
      throw this.validation("Custify returned an invalid segment list.");
    const segments = value.segments.slice(0, limit).map((entry) => {
      const segment = this.object(entry);
      return {
        id: this.scalar(segment.id, 128),
        name: this.scalar(segment.name, 256),
        type: this.scalar(segment.type, 32),
        createdAt: this.scalar(segment.created_at, 64),
        updatedAt: this.scalar(segment.updated_at, 64),
      };
    });
    return {
      semanticReadContract: "custify-segment-inventory-v1",
      segments,
      returnedCount: segments.length,
      maxResults: limit,
      segmentType: type,
      providerRequestCount: 1,
      goalsReturned: false,
      tagsReturned: false,
      membershipReturned: false,
      customerDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchSegments(
    credentials: CustifyCredentials,
    limit: number,
    type: string,
  ) {
    const origin = this.origin(credentials.apiOrigin);
    const url = new URL(CustifyApiAdapter.path, `${origin}/`);
    url.searchParams.set("itemsPerPage", String(limit));
    url.searchParams.set("page", "1");
    url.searchParams.set("type", type);
    if (
      url.origin !== origin ||
      url.pathname !== CustifyApiAdapter.path ||
      url.searchParams.size !== 3 ||
      url.hash
    )
      throw new CustifyApiError(
        "policy_blocked",
        "Custify request escaped Relay's fixed segment-inventory allowlist.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.secret(credentials.apiKey)}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new CustifyApiError(
        "provider_unavailable",
        "Custify API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 500_000)
      throw this.validation("Custify response exceeded Relay's 500 KB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Custify returned invalid JSON.");
    }
    if (!response.ok)
      throw new CustifyApiError(
        this.errorCode(response.status),
        "Custify rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new CustifyApiError(
        "credential_missing",
        "Custify API key is missing.",
        401,
      );
    return result;
  }
  private origin(value: string) {
    let url: URL;
    try {
      url = new URL(value?.trim());
    } catch {
      throw this.validation("Custify API origin is invalid.");
    }
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      (hostname !== "api.custify.com" && !hostname.endsWith(".custify.com")) ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    )
      throw this.validation(
        "Custify API origin must be an HTTPS custify.com origin.",
      );
    return url.origin;
  }
  private limit(value: unknown) {
    if (value === undefined) return 50;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 50)
      throw this.validation("limit must be an integer from 1 to 50.");
    return Number(value);
  }
  private type(value: unknown) {
    if (value === undefined) return "company";
    if (value !== "company" && value !== "people")
      throw this.validation("type must be company or people.");
    return value;
  }
  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new CustifyApiError("provider_validation_error", message);
  }
}
