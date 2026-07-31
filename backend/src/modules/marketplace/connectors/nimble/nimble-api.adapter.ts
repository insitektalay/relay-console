import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type NimbleCredentials = { apiKey: string };

export class NimbleApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class NimbleApiAdapter {
  private static readonly url = "https://app.nimble.com/api/v1/contacts/fields";
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: NimbleCredentials) {
    await this.fetchFields(credentials);
    return {
      credentialsVerified: true,
      fixedProviderOrigin: true,
      fieldDataReturned: false,
      contactDataReturned: false,
      writesEnabled: false,
    };
  }

  async listContactFields(credentials: NimbleCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const value = this.object(await this.fetchFields(credentials));
    if (!Array.isArray(value.tabs))
      throw this.validation("Nimble returned invalid contact-field metadata.");
    const fields: JsonObject[] = [];
    for (const tabEntry of value.tabs) {
      const tab = this.object(tabEntry);
      const tabName = this.scalar(tab.tab_name, 256);
      const contactTypes = Array.isArray(tab.contact_types)
        ? tab.contact_types
            .filter((entry): entry is string => typeof entry === "string")
            .slice(0, 4)
        : typeof tab.contact_types === "string"
          ? [tab.contact_types.slice(0, 64)]
          : [];
      if (!Array.isArray(tab.members)) continue;
      for (const memberEntry of tab.members) {
        const member = this.object(memberEntry);
        if (member.type === "field")
          this.pushField(fields, member, tabName, null, contactTypes, limit);
        if (member.type === "group" && Array.isArray(member.fields)) {
          const groupName = this.scalar(member.name, 256);
          for (const fieldEntry of member.fields)
            this.pushField(
              fields,
              this.object(fieldEntry),
              tabName,
              groupName,
              contactTypes,
              limit,
            );
        }
        if (fields.length >= limit) break;
      }
      if (fields.length >= limit) break;
    }
    return {
      semanticReadContract: "nimble-contact-field-metadata-v1",
      fields,
      returnedCount: fields.length,
      maxResults: limit,
      providerRequestCount: 1,
      presentationReturned: false,
      validationRulesReturned: false,
      choicesReturned: false,
      availableActionsReturned: false,
      contactDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private pushField(
    output: JsonObject[],
    field: JsonObject,
    tabName: string | null,
    groupName: string | null,
    contactTypes: string[],
    limit: number,
  ) {
    if (output.length >= limit || field.type !== "field") return;
    const fieldType = this.object(field.field_type);
    output.push({
      tabName,
      groupName,
      contactTypes,
      id: this.scalar(field.field_id, 128),
      name: this.scalar(field.name, 256),
      modifier: this.scalar(field.modifier, 128),
      multiples: typeof field.multiples === "boolean" ? field.multiples : null,
      readOnly: typeof field.read_only === "boolean" ? field.read_only : null,
      kind: this.scalar(fieldType.field_kind, 64),
    });
  }

  private async fetchFields(credentials: NimbleCredentials) {
    const apiKey = this.secret(credentials.apiKey);
    let response: Response;
    try {
      response = await this.request(NimbleApiAdapter.url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new NimbleApiError(
        "provider_unavailable",
        "Nimble API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 500_000)
      throw this.validation("Nimble response exceeded Relay's 500 KB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Nimble returned invalid JSON.");
    }
    if (!response.ok)
      throw new NimbleApiError(
        this.errorCode(response.status),
        "Nimble rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new NimbleApiError(
        "credential_missing",
        "Nimble API key is missing.",
        401,
      );
    if (/\r|\n/.test(result))
      throw this.validation("Nimble API key contains invalid characters.");
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
    return new NimbleApiError("provider_validation_error", message);
  }
}
