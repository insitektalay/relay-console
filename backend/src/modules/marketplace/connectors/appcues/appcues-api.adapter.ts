import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type AppcuesCredentials = {
  apiKey: string;
  apiSecret: string;
  accountId: string;
  region: string;
};

export class AppcuesApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class AppcuesApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: AppcuesCredentials) {
    await this.fetchFlows(credentials);
    return {
      credentialsVerified: true,
      exactAccountBound: true,
      region: this.region(credentials.region),
      flowDataReturned: false,
      userDataReturned: false,
      writesEnabled: false,
    };
  }

  async listFlows(credentials: AppcuesCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const value = await this.fetchFlows(credentials);
    if (!Array.isArray(value))
      throw this.validation("Appcues returned an invalid flow list.");
    const flows = value.slice(0, limit).map((entry) => {
      const flow = this.object(entry);
      return {
        flowId: this.scalar(flow.id, 128),
        name: this.scalar(flow.name, 256),
        published: typeof flow.published === "boolean" ? flow.published : null,
        frequency: this.scalar(flow.frequency, 64),
        createdAt: this.scalar(flow.created_at, 64),
        updatedAt: this.scalar(flow.updated_at, 64),
        publishedAt: this.scalar(flow.published_at, 64),
      };
    });
    return {
      semanticReadContract: "appcues-flow-inventory-v1",
      flows,
      returnedCount: flows.length,
      maxResults: limit,
      region: this.region(credentials.region),
      providerRequestCount: 1,
      creatorIdsReturned: false,
      tagIdsReturned: false,
      urlsReturned: false,
      flowContentReturned: false,
      userDataReturned: false,
      segmentDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchFlows(credentials: AppcuesCredentials) {
    const apiKey = this.secret(credentials.apiKey, "API key");
    const apiSecret = this.secret(credentials.apiSecret, "API secret");
    const accountId = this.identifier(credentials.accountId, "account ID");
    const region = this.region(credentials.region);
    const origin =
      region === "eu"
        ? "https://api.eu.appcues.com"
        : "https://api.appcues.com";
    const path = `/v2/accounts/${encodeURIComponent(accountId)}/flows`;
    const url = new URL(path, `${origin}/`);
    if (
      url.origin !== origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new AppcuesApiError(
        "policy_blocked",
        "Appcues request escaped Relay's fixed flow-inventory allowlist.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new AppcuesApiError(
        "provider_unavailable",
        "Appcues Public API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Appcues response exceeded Relay's 1 MB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : [];
    } catch {
      throw this.validation("Appcues returned invalid JSON.");
    }
    if (!response.ok)
      throw new AppcuesApiError(
        this.errorCode(response.status),
        "Appcues rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private secret(value: string, label: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new AppcuesApiError(
        "credential_missing",
        `Appcues ${label} is missing.`,
        401,
      );
    return result;
  }

  private identifier(value: string, label: string) {
    const result = value?.trim();
    if (!result || !/^[A-Za-z0-9_-]{1,128}$/.test(result))
      throw this.validation(`Appcues ${label} is invalid.`);
    return result;
  }

  private region(value: string) {
    const region = value?.trim().toLowerCase();
    if (region !== "us" && region !== "eu")
      throw this.validation("Appcues region must be us or eu.");
    return region;
  }

  private limit(value: unknown) {
    if (value === undefined) return 50;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 50)
      throw this.validation("limit must be an integer from 1 to 50.");
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
    return new AppcuesApiError("provider_validation_error", message);
  }
}
