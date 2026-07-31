import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type VitallyCredentials = { apiKey: string; apiOrigin: string };

export class VitallyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class VitallyApiAdapter {
  private static readonly path = "/resources/customFields";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: VitallyCredentials) {
    await this.fetchTraits(credentials, "accounts");
    return {
      credentialsVerified: true,
      exactEnvironmentBound: true,
      apiOrigin: this.origin(credentials.apiOrigin),
      traitDataReturned: false,
      customerDataReturned: false,
      writesEnabled: false,
    };
  }

  async listCustomTraits(credentials: VitallyCredentials, input: JsonObject) {
    const model = this.model(input.model);
    const limit = this.limit(input.limit);
    const value = await this.fetchTraits(credentials, model);
    if (!Array.isArray(value))
      throw this.validation("Vitally returned an invalid custom-trait list.");
    const traits = value.slice(0, limit).map((entry) => {
      const trait = this.object(entry);
      return {
        traitId: this.scalar(trait.id, 128),
        label: this.scalar(trait.label, 256),
        path: this.scalar(trait.path, 256),
        type: this.scalar(trait.type, 64),
        createdAt: this.scalar(trait.createdAt, 64),
      };
    });
    return {
      semanticReadContract: "vitally-custom-trait-schema-v1",
      model,
      traits,
      returnedCount: traits.length,
      maxResults: limit,
      providerRequestCount: 1,
      configuredOptionsReturned: false,
      traitValuesReturned: false,
      customerDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchTraits(credentials: VitallyCredentials, model: string) {
    const apiKey = this.secret(credentials.apiKey);
    const origin = this.origin(credentials.apiOrigin);
    const url = new URL(VitallyApiAdapter.path, `${origin}/`);
    url.searchParams.set("model", model);
    if (
      url.origin !== origin ||
      url.pathname !== VitallyApiAdapter.path ||
      url.searchParams.size !== 1 ||
      url.searchParams.get("model") !== model ||
      url.hash
    )
      throw new VitallyApiError(
        "policy_blocked",
        "Vitally request escaped Relay's fixed custom-trait allowlist.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new VitallyApiError(
        "provider_unavailable",
        "Vitally REST API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Vitally response exceeded Relay's 1 MB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : [];
    } catch {
      throw this.validation("Vitally returned invalid JSON.");
    }
    if (!response.ok)
      throw new VitallyApiError(
        this.errorCode(response.status),
        "Vitally rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new VitallyApiError(
        "credential_missing",
        "Vitally REST API key is missing.",
        401,
      );
    return result;
  }

  private origin(value: string) {
    let url: URL;
    try {
      url = new URL(value?.trim());
    } catch {
      throw this.validation("Vitally REST API origin is invalid.");
    }
    const hostname = url.hostname.toLowerCase();
    const allowed =
      hostname === "rest.vitally-eu.io" ||
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.rest\.vitally\.io$/.test(
        hostname,
      );
    if (
      url.protocol !== "https:" ||
      !allowed ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    )
      throw this.validation(
        "Vitally REST API origin must be the EU origin or an exact US subdomain origin.",
      );
    return url.origin;
  }

  private model(value: unknown) {
    const models = new Set([
      "users",
      "accounts",
      "organizations",
      "tasks",
      "notes",
      "projects",
      "conversations",
      "team",
    ]);
    if (typeof value !== "string" || !models.has(value))
      throw this.validation("model is not allowed.");
    return value;
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
    return new VitallyApiError("provider_validation_error", message);
  }
}
