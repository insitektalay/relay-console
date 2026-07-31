import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type MeltwaterCredentials = { apiToken: string };

export class MeltwaterApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class MeltwaterApiAdapter {
  static readonly apiOrigin = "https://api.meltwater.com";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: MeltwaterCredentials) {
    await this.get(credentials, "/v3/usage/me/requests?period=24hours");
    return { apiOrigin: MeltwaterApiAdapter.apiOrigin };
  }

  async getUsage(credentials: MeltwaterCredentials) {
    const body = this.record(
      await this.get(credentials, "/v3/usage/me/requests?period=24hours"),
    );
    return {
      period: "24hours",
      count: this.safeNumber(body.count),
      units: this.safeEnum(body.units),
      timeSeriesPointCount: Array.isArray(body.time_series)
        ? Math.min(body.time_series.length, 10_000)
        : 0,
      redactionStatus: "token-and-endpoint-details-excluded",
    };
  }

  async listSearches(credentials: MeltwaterCredentials) {
    const body = this.record(await this.get(credentials, "/v3/searches"));
    const source = Array.isArray(body.searches) ? body.searches : [];
    return {
      searches: source
        .slice(0, 25)
        .map((value) => this.search(value))
        .filter((value) => value.searchId),
      redactionStatus: "search-identity-query-and-content-excluded",
    };
  }

  private async get(credentials: MeltwaterCredentials, path: string) {
    this.validate(credentials);
    if (
      path !== "/v3/usage/me/requests?period=24hours" &&
      path !== "/v3/searches"
    )
      throw this.validation(
        "Meltwater API path is outside the Relay allowlist.",
      );
    let response: Response;
    try {
      response = await this.requester(
        new URL(path, MeltwaterApiAdapter.apiOrigin),
        {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
          headers: {
            Accept: "application/json",
            apikey: credentials.apiToken,
            "User-Agent": "RelayConsole-Meltwater/1.0",
          },
        },
      );
    } catch (error) {
      if (error instanceof MeltwaterApiError) throw error;
      throw new MeltwaterApiError(
        "provider_unavailable",
        "Meltwater could not be reached.",
      );
    }
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_000_000)
      throw this.validation(
        "Meltwater response exceeds the 1 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 1_000_000)
      throw this.validation(
        "Meltwater response exceeds the 1 MB Relay boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation(
        "Meltwater returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new MeltwaterApiError(
        this.safeCode(response.status),
        `Meltwater returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validate(credentials: MeltwaterCredentials) {
    if (
      !credentials.apiToken.trim() ||
      credentials.apiToken.length > 30_000 ||
      /[\r\n]/.test(credentials.apiToken)
    )
      throw new MeltwaterApiError(
        "credential_missing",
        "A valid Meltwater API token is required.",
        401,
      );
  }
  private search(value: unknown) {
    const item = this.record(value);
    return {
      searchId: this.resourceId(item.id ?? item.search_id),
      updatedAt: this.safeTimestamp(item.updated),
    };
  }
  private resourceId(value: unknown) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
      return String(value);
    const text = typeof value === "string" ? value : "";
    return /^[A-Za-z0-9_-]{1,128}$/.test(text) ? text : null;
  }
  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private safeEnum(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(value)
      ? value
      : null;
  }
  private safeTimestamp(value: unknown) {
    return typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)
      ? value
      : null;
  }
  private safeNumber(value: unknown) {
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403 || status === 404) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string, statusCode?: number) {
    return new MeltwaterApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
