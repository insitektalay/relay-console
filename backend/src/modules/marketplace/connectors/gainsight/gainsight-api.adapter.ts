import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type GainsightCredentials = { accessKey: string; tenantOrigin: string };

export class GainsightApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GainsightApiAdapter {
  private static readonly path = "/v1/meta/services/objects/list";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: GainsightCredentials) {
    await this.fetchObjects(credentials);
    return {
      credentialsVerified: true,
      exactTenantBound: true,
      tenantOrigin: this.origin(credentials.tenantOrigin),
      objectDataReturned: false,
      customerDataReturned: false,
      writesEnabled: false,
    };
  }

  async listObjects(credentials: GainsightCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const value = this.object(await this.fetchObjects(credentials));
    if (value.result !== true || !Array.isArray(value.data))
      throw this.validation("Gainsight returned an invalid object list.");
    const objects = value.data.slice(0, limit).map((entry) => {
      const object = this.object(entry);
      return {
        objectName: this.scalar(object.objectName, 256),
        label: this.scalar(object.label, 256),
        objectType: this.scalar(object.objectType, 64),
        transactional:
          typeof object.transactional === "boolean"
            ? object.transactional
            : null,
        multiCurrencySupported:
          typeof object.multiCurrencySupported === "boolean"
            ? object.multiCurrencySupported
            : null,
        readable: typeof object.readable === "boolean" ? object.readable : null,
      };
    });
    return {
      semanticReadContract: "gainsight-object-metadata-inventory-v1",
      objects,
      returnedCount: objects.length,
      maxResults: limit,
      providerRequestCount: 1,
      requestIdReturned: false,
      keyPrefixesReturned: false,
      createUpdateFlagsReturned: false,
      fieldMetadataReturned: false,
      customerDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchObjects(credentials: GainsightCredentials) {
    const accessKey = this.secret(credentials.accessKey);
    const origin = this.origin(credentials.tenantOrigin);
    const url = new URL(GainsightApiAdapter.path, `${origin}/`);
    url.searchParams.set("po", "company");
    url.searchParams.set("em", "false");
    if (
      url.origin !== origin ||
      url.pathname !== GainsightApiAdapter.path ||
      url.searchParams.size !== 2 ||
      url.searchParams.get("po") !== "company" ||
      url.searchParams.get("em") !== "false" ||
      url.hash
    )
      throw new GainsightApiError(
        "policy_blocked",
        "Gainsight request escaped Relay's fixed object-metadata allowlist.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json", accesskey: accessKey },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new GainsightApiError(
        "provider_unavailable",
        "Gainsight Data Management API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Gainsight response exceeded Relay's 1 MB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Gainsight returned invalid JSON.");
    }
    if (!response.ok)
      throw new GainsightApiError(
        this.errorCode(response.status),
        "Gainsight rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new GainsightApiError(
        "credential_missing",
        "Gainsight access key is missing.",
        401,
      );
    return result;
  }

  private origin(value: string) {
    let url: URL;
    try {
      url = new URL(value?.trim());
    } catch {
      throw this.validation("Gainsight tenant origin is invalid.");
    }
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      !hostname.endsWith(".gainsightcloud.com") ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    )
      throw this.validation(
        "Gainsight tenant origin must be an HTTPS gainsightcloud.com origin.",
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
    return new GainsightApiError("provider_validation_error", message);
  }
}
