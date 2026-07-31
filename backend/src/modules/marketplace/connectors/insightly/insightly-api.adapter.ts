import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type InsightlyCredentials = { apiKey: string; apiBaseUrl: string };

export class InsightlyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class InsightlyApiAdapter {
  private static readonly pathSuffix = "/CustomFields";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: InsightlyCredentials) {
    await this.fetchFields(credentials);
    return {
      credentialsVerified: true,
      exactPodBound: true,
      fieldDataReturned: false,
      recordDataReturned: false,
      writesEnabled: false,
    };
  }

  async listCustomFields(credentials: InsightlyCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const value = await this.fetchFields(credentials);
    if (!Array.isArray(value))
      throw this.validation("Insightly returned an invalid custom-field list.");
    const fields = value.slice(0, limit).map((entry) => {
      const field = this.object(entry);
      return {
        name: this.scalar(field.FIELD_NAME, 256),
        order: this.integer(field.FIELD_ORDER),
        object: this.scalar(field.FIELD_FOR, 128),
        label: this.scalar(field.FIELD_LABEL, 256),
        type: this.scalar(field.FIELD_TYPE, 64),
        editable: typeof field.EDITABLE === "boolean" ? field.EDITABLE : null,
        visible: typeof field.VISIBLE === "boolean" ? field.VISIBLE : null,
      };
    });
    return {
      semanticReadContract: "insightly-custom-field-metadata-v1",
      fields,
      returnedCount: fields.length,
      maxResults: limit,
      providerRequestCount: 1,
      helpTextReturned: false,
      defaultsReturned: false,
      optionsReturned: false,
      dependenciesReturned: false,
      recordDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchFields(credentials: InsightlyCredentials) {
    const base = this.base(credentials.apiBaseUrl);
    const url = new URL(
      `${base.pathname}${InsightlyApiAdapter.pathSuffix}`,
      `${base.origin}/`,
    );
    if (
      url.origin !== base.origin ||
      url.pathname !== `${base.pathname}${InsightlyApiAdapter.pathSuffix}` ||
      url.search ||
      url.hash
    )
      throw new InsightlyApiError(
        "policy_blocked",
        "Insightly request escaped Relay's fixed custom-field allowlist.",
        403,
      );
    const apiKey = this.secret(credentials.apiKey);
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(apiKey, "utf8").toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new InsightlyApiError(
        "provider_unavailable",
        "Insightly API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 500_000)
      throw this.validation(
        "Insightly response exceeded Relay's 500 KB bound.",
      );
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : [];
    } catch {
      throw this.validation("Insightly returned invalid JSON.");
    }
    if (!response.ok)
      throw new InsightlyApiError(
        this.errorCode(response.status),
        "Insightly rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private base(value: string) {
    let url: URL;
    try {
      url = new URL(value?.trim());
    } catch {
      throw this.validation("Insightly API base URL is invalid.");
    }
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/$/, "");
    if (
      url.protocol !== "https:" ||
      !/^api\.[a-z0-9-]+\.insightly\.com$/.test(hostname) ||
      url.username ||
      url.password ||
      url.port ||
      pathname !== "/v3.1" ||
      url.search ||
      url.hash
    )
      throw this.validation(
        "Insightly API base URL must be an HTTPS api.<pod>.insightly.com URL ending in /v3.1.",
      );
    return { origin: url.origin, pathname };
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new InsightlyApiError(
        "credential_missing",
        "Insightly API key is missing.",
        401,
      );
    if (/\r|\n/.test(result))
      throw this.validation("Insightly API key contains invalid characters.");
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
    return new InsightlyApiError("provider_validation_error", message);
  }
}
