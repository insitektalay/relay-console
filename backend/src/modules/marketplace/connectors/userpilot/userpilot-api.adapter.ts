import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type UserpilotCredentials = { apiKey: string; apiOrigin: string };

export class UserpilotApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class UserpilotApiAdapter {
  private static readonly path =
    "/api/v1/analytics/exports/lookups/features_events";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: UserpilotCredentials) {
    await this.fetchDefinitions(credentials);
    return {
      credentialsVerified: true,
      exactEnvironmentBound: true,
      apiOrigin: this.origin(credentials.apiOrigin),
      definitionDataReturned: false,
      userDataReturned: false,
      writesEnabled: false,
    };
  }

  async listDefinitions(credentials: UserpilotCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const value = await this.fetchDefinitions(credentials);
    if (!Array.isArray(value))
      throw this.validation(
        "Userpilot returned an invalid feature/event list.",
      );
    const definitions = value.slice(0, limit).map((entry) => {
      const definition = this.object(entry);
      return {
        key: this.scalar(definition.key, 256),
        displayName: this.scalar(definition.display_name, 256),
        dataType: this.scalar(definition.data_type, 64),
      };
    });
    return {
      semanticReadContract: "userpilot-feature-event-definitions-v1",
      definitions,
      returnedCount: definitions.length,
      maxResults: limit,
      providerRequestCount: 1,
      userPropertiesReturned: false,
      companyPropertiesReturned: false,
      segmentsReturned: false,
      analyticsDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchDefinitions(credentials: UserpilotCredentials) {
    const apiKey = this.secret(credentials.apiKey);
    const origin = this.origin(credentials.apiOrigin);
    const url = new URL(UserpilotApiAdapter.path, `${origin}/`);
    if (
      url.origin !== origin ||
      url.pathname !== UserpilotApiAdapter.path ||
      url.search ||
      url.hash
    )
      throw new UserpilotApiError(
        "policy_blocked",
        "Userpilot request escaped Relay's fixed definition-inventory allowlist.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Token ${apiKey}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new UserpilotApiError(
        "provider_unavailable",
        "Userpilot API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Userpilot response exceeded Relay's 1 MB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : [];
    } catch {
      throw this.validation("Userpilot returned invalid JSON.");
    }
    if (!response.ok)
      throw new UserpilotApiError(
        this.errorCode(response.status),
        "Userpilot rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new UserpilotApiError(
        "credential_missing",
        "Userpilot environment API key is missing.",
        401,
      );
    return result;
  }

  private origin(value: string) {
    let url: URL;
    try {
      url = new URL(value?.trim());
    } catch {
      throw this.validation("Userpilot API origin is invalid.");
    }
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      !hostname.endsWith(".userpilot.io") ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    )
      throw this.validation(
        "Userpilot API origin must be an HTTPS userpilot.io origin.",
      );
    return url.origin;
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
    return new UserpilotApiError("provider_validation_error", message);
  }
}
