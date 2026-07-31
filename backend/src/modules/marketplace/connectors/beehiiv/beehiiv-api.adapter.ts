import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type BeehiivCredentials = {
  accessToken: string;
  organizationId: string;
};

export class BeehiivApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class BeehiivApiAdapter {
  static readonly apiOrigin = "https://api.beehiiv.com";
  static readonly oauthOrigin = "https://app.beehiiv.com";
  private readonly lastRequests = new Map<string, number>();
  constructor(
    private readonly requester: Requester = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async health(credentials: BeehiivCredentials) {
    const token = this.record(
      await this.get(credentials, "/oauth/token/info", {}, true),
    );
    const organizationId = this.organizationId(token.resource_owner_id);
    this.assertOrganization(credentials, organizationId);
    return {
      organizationId,
      accountLabel: `beehiiv organization …${organizationId.slice(-8)}`,
      apiOrigin: BeehiivApiAdapter.apiOrigin,
    };
  }

  async getAccountSummary(credentials: BeehiivCredentials) {
    const token = this.record(
      await this.get(credentials, "/oauth/token/info", {}, true),
    );
    const organizationId = this.organizationId(token.resource_owner_id);
    this.assertOrganization(credentials, organizationId);
    return {
      account: {
        organizationId,
        expiresInSeconds: this.nonnegative(token.expires_in_seconds),
        createdAt: this.epoch(token.created_at),
      },
    };
  }

  async listPublications(credentials: BeehiivCredentials) {
    const root = this.record(
      await this.get(credentials, "/v2/publications", {
        limit: "25",
        page: "1",
        direction: "desc",
        order_by: "created",
      }),
    );
    return {
      publications: this.items(root)
        .slice(0, 25)
        .map((value) => this.publication(value)),
    };
  }

  async listPosts(credentials: BeehiivCredentials, publicationId: string) {
    const id = this.publicationId(publicationId);
    const root = this.record(
      await this.get(credentials, `/v2/publications/${id}/posts`, {
        limit: "25",
        page: "1",
        direction: "desc",
        order_by: "created",
      }),
    );
    return {
      publicationId: id,
      posts: this.items(root)
        .slice(0, 25)
        .map((value) => this.post(value)),
    };
  }

  private async get(
    credentials: BeehiivCredentials,
    path: string,
    query: Record<string, string> = {},
    oauth = false,
  ) {
    this.validateCredentials(credentials);
    this.enforceRate(credentials.organizationId);
    const url = new URL(
      path,
      oauth ? BeehiivApiAdapter.oauthOrigin : BeehiivApiAdapter.apiOrigin,
    );
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    const response = await this.requester(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-beehiiv/1.0",
      },
    });
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw this.validation(
        "beehiiv response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw this.validation(
        "beehiiv response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation("beehiiv returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new BeehiivApiError(
        this.safeCode(response.status),
        `beehiiv returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private publication(value: unknown) {
    const item = this.record(value);
    return {
      publicationId: this.publicationId(item.id),
      referralProgramEnabled:
        typeof item.referral_program_enabled === "boolean"
          ? item.referral_program_enabled
          : null,
      createdAt: this.epoch(item.created),
    };
  }

  private post(value: unknown) {
    const item = this.record(value);
    return {
      postId: this.postId(item.id),
      status: this.enumValue(item.status, ["draft", "confirmed", "archived"]),
      audience: this.enumValue(item.audience, ["free", "premium"]),
      platform: this.enumValue(item.platform, ["web", "email", "both"]),
      splitTested:
        typeof item.split_tested === "boolean" ? item.split_tested : null,
      createdAt: this.epoch(item.created),
      publishDate: this.epoch(item.publish_date),
      displayedDate: this.epoch(item.displayed_date),
    };
  }

  private validateCredentials(value: BeehiivCredentials) {
    if (
      !value.accessToken.trim() ||
      !/^org_[0-9a-fA-F-]{1,64}$/.test(value.organizationId)
    )
      throw new BeehiivApiError(
        "credential_missing",
        "beehiiv token or exact-organization binding is missing.",
      );
  }
  private assertOrganization(credentials: BeehiivCredentials, actual: string) {
    if (actual !== credentials.organizationId)
      throw new BeehiivApiError(
        "insufficient_scope",
        "beehiiv resource owner does not match the connected organization.",
        403,
      );
  }
  private enforceRate(key: string) {
    const current = this.now().getTime();
    const previous = this.lastRequests.get(key);
    if (previous !== undefined && current - previous < 350)
      throw new BeehiivApiError(
        "provider_rate_limited",
        "beehiiv permits at most 180 requests per minute per organization.",
        429,
      );
    this.lastRequests.set(key, current);
  }
  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private items(value: JsonObject): unknown[] {
    return Array.isArray(value.data) ? value.data : [];
  }
  private organizationId(value: unknown) {
    const id = String(value ?? "");
    if (!/^org_[0-9a-fA-F-]{1,64}$/.test(id))
      throw this.validation("Organization identifier is invalid.");
    return id;
  }
  private publicationId(value: unknown) {
    const id = String(value ?? "");
    if (!/^pub_[0-9a-fA-F-]{1,64}$/.test(id))
      throw this.validation("Publication identifier is invalid.");
    return id;
  }
  private postId(value: unknown) {
    const id = String(value ?? "");
    if (!/^post_[0-9a-fA-F-]{1,64}$/.test(id))
      throw this.validation("Post identifier is invalid.");
    return id;
  }
  private nonnegative(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }
  private epoch(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0
      ? new Date(number * 1000).toISOString()
      : null;
  }
  private enumValue(value: unknown, allowed: string[]) {
    return typeof value === "string" && allowed.includes(value) ? value : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string, statusCode?: number) {
    return new BeehiivApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
