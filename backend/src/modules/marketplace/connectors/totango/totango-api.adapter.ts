import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type TotangoCredentials = { appToken: string; region: string };

export class TotangoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class TotangoApiAdapter {
  private static readonly path = "/api/v3/activity-types/";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: TotangoCredentials) {
    await this.fetchActivityTypes(credentials);
    return {
      credentialsVerified: true,
      exactRegionBound: true,
      region: this.region(credentials.region),
      flowDataReturned: false,
      customerDataReturned: false,
      writesEnabled: false,
    };
  }

  async listFlows(credentials: TotangoCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const value = this.object(await this.fetchActivityTypes(credentials));
    const flows = Object.entries(value)
      .slice(0, limit)
      .map(([key, entry]) => {
        const flow = this.object(entry);
        return {
          activityTypeId: this.scalar(flow.activity_type_id ?? key, 128),
          displayName: this.scalar(flow.display_name, 256),
          systemType:
            typeof flow.system_type === "boolean" ? flow.system_type : null,
          defaultType:
            typeof flow.default_type === "boolean" ? flow.default_type : null,
          disabled: typeof flow.disabled === "boolean" ? flow.disabled : null,
        };
      });
    return {
      semanticReadContract: "totango-flow-inventory-v1",
      flows,
      returnedCount: flows.length,
      maxResults: limit,
      providerRequestCount: 1,
      activityCountsReturned: false,
      iconsReturned: false,
      customerDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchActivityTypes(credentials: TotangoCredentials) {
    const appToken = this.secret(credentials.appToken);
    const region = this.region(credentials.region);
    const origin =
      region === "eu"
        ? "https://api-eu1.totango.com"
        : "https://api.totango.com";
    const url = new URL(TotangoApiAdapter.path, `${origin}/`);
    if (
      url.origin !== origin ||
      url.pathname !== TotangoApiAdapter.path ||
      url.search ||
      url.hash
    )
      throw new TotangoApiError(
        "policy_blocked",
        "Totango request escaped Relay's fixed flow-inventory allowlist.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json", "app-token": appToken },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new TotangoApiError(
        "provider_unavailable",
        "Totango API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 250_000)
      throw this.validation("Totango response exceeded Relay's 250 KB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Totango returned invalid JSON.");
    }
    if (!response.ok)
      throw new TotangoApiError(
        this.errorCode(response.status),
        "Totango rejected the bounded request.",
        response.status,
      );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.validation("Totango returned an invalid flow inventory.");
    return value;
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new TotangoApiError(
        "credential_missing",
        "Totango app token is missing.",
        401,
      );
    return result;
  }

  private region(value: string) {
    const result = value?.trim().toLowerCase();
    if (result !== "us" && result !== "eu")
      throw this.validation("Totango region must be us or eu.");
    return result;
  }

  private limit(value: unknown) {
    if (value === undefined) return 30;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 30)
      throw this.validation("limit must be an integer from 1 to 30.");
    return Number(value);
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
    return new TotangoApiError("provider_validation_error", message);
  }
}
