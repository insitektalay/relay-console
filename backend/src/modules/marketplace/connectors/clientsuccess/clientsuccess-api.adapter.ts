import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type ClientSuccessCredentials = { authorization: string };

export class ClientSuccessApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ClientSuccessApiAdapter {
  private static readonly origin = "https://api.clientsuccess.com";
  private static readonly path = "/v2/customfield/all/CLIENT";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: ClientSuccessCredentials) {
    await this.fetchFields(credentials);
    return {
      credentialsVerified: true,
      fixedProviderOrigin: true,
      fieldDataReturned: false,
      customerDataReturned: false,
      writesEnabled: false,
    };
  }

  async listClientCustomFields(
    credentials: ClientSuccessCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const value = await this.fetchFields(credentials);
    if (!Array.isArray(value))
      throw this.validation(
        "ClientSuccess returned an invalid custom-field list.",
      );

    const fields = value.slice(0, limit).map((entry) => {
      const field = this.object(entry);
      return {
        id: this.scalar(field.id, 128),
        uuid: this.scalar(field.uuid, 128),
        name: this.scalar(field.name, 256),
        label: this.scalar(field.label, 256),
        resourceType: this.scalar(field.resourceType, 64),
        fieldType: this.scalar(field.fieldType, 64),
        fieldTypeId: this.scalar(field.fieldTypeId, 64),
        system: typeof field.system === "boolean" ? field.system : null,
        required: typeof field.required === "boolean" ? field.required : null,
        active: typeof field.active === "boolean" ? field.active : null,
      };
    });

    return {
      semanticReadContract: "clientsuccess-client-custom-field-metadata-v1",
      fields,
      returnedCount: fields.length,
      maxResults: limit,
      providerRequestCount: 1,
      resourceType: "CLIENT",
      usageCountsReturned: false,
      placeholdersReturned: false,
      optionsReturned: false,
      customerDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchFields(credentials: ClientSuccessCredentials) {
    const url = new URL(
      ClientSuccessApiAdapter.path,
      ClientSuccessApiAdapter.origin,
    );
    url.searchParams.set("system", "false");
    url.searchParams.set("required", "false");
    url.searchParams.set("placeholder", "false");
    url.searchParams.set("includeUsageCounts", "false");
    if (
      url.origin !== ClientSuccessApiAdapter.origin ||
      url.pathname !== ClientSuccessApiAdapter.path ||
      url.searchParams.size !== 4 ||
      url.hash
    )
      throw new ClientSuccessApiError(
        "policy_blocked",
        "ClientSuccess request escaped Relay's fixed custom-field allowlist.",
        403,
      );

    const authorization = this.secret(credentials.authorization);
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: authorization,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new ClientSuccessApiError(
        "provider_unavailable",
        "ClientSuccess API could not be reached.",
        502,
      );
    }

    const raw = await response.text();
    if (Buffer.byteLength(raw) > 500_000)
      throw this.validation(
        "ClientSuccess response exceeded Relay's 500 KB bound.",
      );
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : [];
    } catch {
      throw this.validation("ClientSuccess returned invalid JSON.");
    }
    if (!response.ok)
      throw new ClientSuccessApiError(
        this.errorCode(response.status),
        "ClientSuccess rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new ClientSuccessApiError(
        "credential_missing",
        "ClientSuccess Authorization value is missing.",
        401,
      );
    if (/\r|\n/.test(result))
      throw this.validation(
        "ClientSuccess Authorization value contains invalid characters.",
      );
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
    return new ClientSuccessApiError("provider_validation_error", message);
  }
}
