import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type PlanhatCredentials = { apiToken: string; apiOrigin: string };
export class PlanhatApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class PlanhatApiAdapter {
  private static readonly path = "/customfields";
  constructor(private readonly request: HttpClient = fetch) {}
  async health(credentials: PlanhatCredentials) {
    await this.fetchFields(credentials, 1);
    return {
      credentialsVerified: true,
      exactOriginBound: true,
      fieldDataReturned: false,
      customerDataReturned: false,
      writesEnabled: false,
    };
  }
  async listCustomFields(credentials: PlanhatCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const value = await this.fetchFields(credentials, limit);
    if (!Array.isArray(value))
      throw this.validation("Planhat returned an invalid custom-field list.");
    const fields = value.slice(0, limit).map((entry) => {
      const field = this.object(entry);
      return {
        id: this.scalar(field._id, 128),
        name: this.scalar(field.name, 256),
        type: this.scalar(field.type, 64),
        parent: this.scalar(field.parent, 64),
        featured:
          typeof field.isFeatured === "boolean" ? field.isFeatured : null,
        hidden: typeof field.isHidden === "boolean" ? field.isHidden : null,
        shared: typeof field.isShared === "boolean" ? field.isShared : null,
        locked: typeof field.isLocked === "boolean" ? field.isLocked : null,
        mandatory:
          typeof field.isMandatory === "boolean" ? field.isMandatory : null,
      };
    });
    return {
      semanticReadContract: "planhat-custom-field-metadata-v1",
      fields,
      returnedCount: fields.length,
      maxResults: limit,
      providerRequestCount: 1,
      formulasReturned: false,
      listValuesReturned: false,
      filtersReturned: false,
      referencesReturned: false,
      customerDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }
  private async fetchFields(credentials: PlanhatCredentials, limit: number) {
    const origin = this.origin(credentials.apiOrigin);
    const url = new URL(PlanhatApiAdapter.path, `${origin}/`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", "0");
    url.searchParams.set(
      "select",
      "_id,name,type,parent,isFeatured,isHidden,isShared,isLocked,isMandatory",
    );
    if (
      url.origin !== origin ||
      url.pathname !== PlanhatApiAdapter.path ||
      url.searchParams.size !== 3 ||
      url.hash
    )
      throw new PlanhatApiError(
        "policy_blocked",
        "Planhat request escaped Relay's fixed custom-field allowlist.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.secret(credentials.apiToken)}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new PlanhatApiError(
        "provider_unavailable",
        "Planhat API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 500_000)
      throw this.validation("Planhat response exceeded Relay's 500 KB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : [];
    } catch {
      throw this.validation("Planhat returned invalid JSON.");
    }
    if (!response.ok)
      throw new PlanhatApiError(
        this.errorCode(response.status),
        "Planhat rejected the bounded request.",
        response.status,
      );
    return value;
  }
  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new PlanhatApiError(
        "credential_missing",
        "Planhat API token is missing.",
        401,
      );
    return result;
  }
  private origin(value: string) {
    let url: URL;
    try {
      url = new URL(value?.trim());
    } catch {
      throw this.validation("Planhat API origin is invalid.");
    }
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      (hostname !== "api.planhat.com" && !hostname.endsWith(".planhat.com")) ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    )
      throw this.validation(
        "Planhat API origin must be an HTTPS planhat.com origin.",
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
    return new PlanhatApiError("provider_validation_error", message);
  }
}
