import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type KeapCredentials = { accessToken: string };

export class KeapApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class KeapApiAdapter {
  private static readonly url =
    "https://api.infusionsoft.com/crm/rest/v2/contacts/model";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: KeapCredentials) {
    await this.fetchContactModel(credentials);
    return {
      credentialsVerified: true,
      fixedProviderOrigin: true,
      fieldDataReturned: false,
      contactDataReturned: false,
      writesEnabled: false,
    };
  }

  async listContactCustomFields(
    credentials: KeapCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const root = this.object(await this.fetchContactModel(credentials));
    if (!Array.isArray(root.custom_fields))
      throw this.validation("Keap returned an invalid contact-model response.");
    const fields = root.custom_fields.slice(0, limit).map((entry) => {
      const field = this.object(entry);
      return {
        id: this.scalar(field.id, 128),
        label: this.scalar(field.label, 256),
        recordType: this.scalar(field.record_type, 64),
        fieldType: this.scalar(field.field_type, 64),
        fieldName: this.scalar(field.field_name, 256),
      };
    });
    return {
      semanticReadContract: "keap-contact-custom-field-metadata-v1",
      fields,
      returnedCount: fields.length,
      maxResults: limit,
      providerRequestCount: 1,
      optionsReturned: false,
      defaultValuesReturned: false,
      groupMetadataReturned: false,
      optionalPropertiesReturned: false,
      contactDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchContactModel(credentials: KeapCredentials) {
    const token = this.secret(credentials.accessToken);
    let response: Response;
    try {
      response = await this.request(KeapApiAdapter.url, {
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
      throw new KeapApiError(
        "provider_unavailable",
        "Keap API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 500_000)
      throw this.validation("Keap response exceeded Relay's 500 KB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Keap returned invalid JSON.");
    }
    if (!response.ok)
      throw new KeapApiError(
        this.errorCode(response.status),
        "Keap rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new KeapApiError(
        "credential_missing",
        "Keap access token is missing.",
        401,
      );
    if (/\r|\n/.test(result))
      throw this.validation("Keap access token contains invalid characters.");
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
    return new KeapApiError("provider_validation_error", message);
  }
}
