import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type FreshsalesCredentials = { apiKey: string; apiBaseUrl: string };

export class FreshsalesApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class FreshsalesApiAdapter {
  private static readonly pathSuffix = "/api/contacts/filters";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: FreshsalesCredentials) {
    await this.fetchFilters(credentials);
    return {
      credentialsVerified: true,
      exactAccountBound: true,
      filterDataReturned: false,
      contactDataReturned: false,
      writesEnabled: false,
    };
  }

  async listContactFilters(
    credentials: FreshsalesCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const value = await this.fetchFilters(credentials);
    const root = this.object(value);
    if (!Array.isArray(root.filters))
      throw this.validation(
        "Freshsales returned an invalid contact-filter list.",
      );
    const filters = root.filters.slice(0, limit).map((entry) => {
      const filter = this.object(entry);
      return {
        id: this.scalar(filter.id, 128),
        name: this.scalar(filter.name, 256),
      };
    });
    return {
      semanticReadContract: "freshsales-contact-filter-metadata-v1",
      filters,
      returnedCount: filters.length,
      maxResults: limit,
      providerRequestCount: 1,
      criteriaReturned: false,
      contactDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchFilters(credentials: FreshsalesCredentials) {
    const base = this.base(credentials.apiBaseUrl);
    const url = new URL(
      `${base.pathname}${FreshsalesApiAdapter.pathSuffix}`,
      `${base.origin}/`,
    );
    if (
      url.origin !== base.origin ||
      url.pathname !== `${base.pathname}${FreshsalesApiAdapter.pathSuffix}` ||
      url.search ||
      url.hash
    )
      throw new FreshsalesApiError(
        "policy_blocked",
        "Freshsales request escaped Relay's fixed contact-filter allowlist.",
        403,
      );
    const apiKey = this.secret(credentials.apiKey);
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Token token=${apiKey}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new FreshsalesApiError(
        "provider_unavailable",
        "Freshsales API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 500_000)
      throw this.validation(
        "Freshsales response exceeded Relay's 500 KB bound.",
      );
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Freshsales returned invalid JSON.");
    }
    if (!response.ok)
      throw new FreshsalesApiError(
        this.errorCode(response.status),
        "Freshsales rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private base(value: string) {
    let url: URL;
    try {
      url = new URL(value?.trim());
    } catch {
      throw this.validation("Freshsales API base URL is invalid.");
    }
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/$/, "");
    if (
      url.protocol !== "https:" ||
      (!hostname.endsWith(".myfreshworks.com") &&
        !hostname.endsWith(".freshworks.com")) ||
      url.username ||
      url.password ||
      url.port ||
      pathname !== "/crm/sales" ||
      url.search ||
      url.hash
    )
      throw this.validation(
        "Freshsales API base URL must be an HTTPS Freshworks account URL ending in /crm/sales.",
      );
    return { origin: url.origin, pathname };
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new FreshsalesApiError(
        "credential_missing",
        "Freshsales API key is missing.",
        401,
      );
    if (/\r|\n/.test(result))
      throw this.validation("Freshsales API key contains invalid characters.");
    return result;
  }

  private limit(value: unknown) {
    if (value === undefined) return 100;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 100
    )
      throw this.validation("limit must be an integer from 1 to 100.");
    return Number(value);
  }

  private scalar(value: unknown, max: number) {
    if (typeof value === "number" && Number.isSafeInteger(value))
      return String(value);
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
    return new FreshsalesApiError("provider_validation_error", message);
  }
}
