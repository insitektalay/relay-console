import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type UserflowCredentials = { apiKey: string; region: string };

export class UserflowApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class UserflowApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: UserflowCredentials) {
    await this.fetchContent(credentials, 1);
    return {
      credentialsVerified: true,
      exactEnvironmentBound: true,
      region: this.region(credentials.region),
      contentDataReturned: false,
      userDataReturned: false,
      writesEnabled: false,
    };
  }

  async listContent(credentials: UserflowCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const value = this.object(await this.fetchContent(credentials, limit));
    if (!Array.isArray(value.data))
      throw this.validation("Userflow returned an invalid content list.");
    const content = value.data.slice(0, limit).map((entry) => {
      const item = this.object(entry);
      return {
        contentId: this.scalar(item.id, 128),
        name: this.scalar(item.name, 256),
        type: this.contentType(item.type),
        createdAt: this.scalar(item.created_at, 64),
        draftVersionId: this.scalar(item.draft_version_id, 128),
        publishedVersionId: this.scalar(item.published_version_id, 128),
      };
    });
    return {
      semanticReadContract: "userflow-content-inventory-v1",
      content,
      returnedCount: content.length,
      maxResults: limit,
      hasMore: value.has_more === true,
      region: this.region(credentials.region),
      providerRequestCount: 1,
      labelsReturned: false,
      contentVersionsReturned: false,
      contentSessionsReturned: false,
      userDataReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchContent(credentials: UserflowCredentials, limit: number) {
    const apiKey = this.secret(credentials.apiKey);
    const region = this.region(credentials.region);
    const origin =
      region === "eu"
        ? "https://api.eu.userflow.com"
        : "https://api.userflow.com";
    const url = new URL("/content", `${origin}/`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("order_by", "name");
    if (
      url.origin !== origin ||
      url.pathname !== "/content" ||
      url.searchParams.size !== 2 ||
      url.searchParams.get("limit") !== String(limit) ||
      url.searchParams.get("order_by") !== "name" ||
      url.hash
    )
      throw new UserflowApiError(
        "policy_blocked",
        "Userflow request escaped Relay's fixed content-inventory allowlist.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Userflow-Version": "2020-01-03",
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new UserflowApiError(
        "provider_unavailable",
        "Userflow API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Userflow response exceeded Relay's 1 MB bound.");
    let value: unknown;
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Userflow returned invalid JSON.");
    }
    if (!response.ok)
      throw new UserflowApiError(
        this.errorCode(response.status),
        "Userflow rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private secret(value: string) {
    const result = value?.trim();
    if (!result || result.length > 20_000)
      throw new UserflowApiError(
        "credential_missing",
        "Userflow environment API key is missing.",
        401,
      );
    return result;
  }

  private region(value: string) {
    const region = value?.trim().toLowerCase();
    if (region !== "us" && region !== "eu")
      throw this.validation("Userflow region must be us or eu.");
    return region;
  }

  private limit(value: unknown) {
    if (value === undefined) return 50;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 50)
      throw this.validation("limit must be an integer from 1 to 50.");
    return Number(value);
  }

  private contentType(value: unknown) {
    const supported = new Set([
      "announcement",
      "assistant",
      "banner",
      "checklist",
      "embed",
      "flow",
      "launcher",
      "resource_center",
      "tracker",
    ]);
    return typeof value === "string" && supported.has(value) ? value : null;
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
    return new UserflowApiError("provider_validation_error", message);
  }
}
