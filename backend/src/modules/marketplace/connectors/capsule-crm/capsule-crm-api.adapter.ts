import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type CapsuleCrmCredentials = { accessToken: string };
export class CapsuleCrmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
export class CapsuleCrmApiAdapter {
  private static readonly url =
    "https://api.capsulecrm.com/api/v2/parties/fields/definitions?page=1&perPage=100";
  constructor(private readonly request: HttpClient = fetch) {}
  async health(credentials: CapsuleCrmCredentials) {
    await this.fetchDefinitions(credentials);
    return {
      credentialsVerified: true,
      fixedProviderOrigin: true,
      fieldDataReturned: false,
      recordDataReturned: false,
      writesEnabled: false,
    };
  }
  async listPartyCustomFields(
    credentials: CapsuleCrmCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const root = this.object(await this.fetchDefinitions(credentials));
    if (!Array.isArray(root.definitions))
      throw this.validation(
        "Capsule CRM returned an invalid custom-field list.",
      );
    const fields = root.definitions.slice(0, limit).map((entry) => {
      const field = this.object(entry);
      return {
        id: this.scalar(field.id, 128),
        name: this.scalar(field.name, 256),
        type: this.scalar(field.type, 64),
        displayOrder: this.integer(field.displayOrder),
        captureRule: this.scalar(field.captureRule, 64),
        important:
          typeof field.important === "boolean" ? field.important : null,
      };
    });
    return {
      semanticReadContract: "capsule-crm-party-custom-field-metadata-v1",
      fields,
      returnedCount: fields.length,
      maxResults: limit,
      providerRequestCount: 1,
      entity: "parties",
      descriptionsReturned: false,
      tagsReturned: false,
      optionsReturned: false,
      recordDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }
  private async fetchDefinitions(credentials: CapsuleCrmCredentials) {
    const token = this.secret(credentials.accessToken);
    let response: Response;
    try {
      response = await this.request(CapsuleCrmApiAdapter.url, {
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
      throw new CapsuleCrmApiError(
        "provider_unavailable",
        "Capsule CRM API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 500_000)
      throw this.validation(
        "Capsule CRM response exceeded Relay's 500 KB bound.",
      );
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Capsule CRM returned invalid JSON.");
    }
    if (!response.ok)
      throw new CapsuleCrmApiError(
        this.errorCode(response.status),
        "Capsule CRM rejected the bounded request.",
        response.status,
      );
    return value;
  }
  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new CapsuleCrmApiError(
        "credential_missing",
        "Capsule CRM access token is missing.",
        401,
      );
    if (/\r|\n/.test(result))
      throw this.validation(
        "Capsule CRM access token contains invalid characters.",
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
  private integer(value: unknown) {
    return Number.isSafeInteger(value) ? Number(value) : null;
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
    return new CapsuleCrmApiError("provider_validation_error", message);
  }
}
