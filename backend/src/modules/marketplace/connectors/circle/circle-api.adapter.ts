import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type CircleCredentials = { apiToken: string };

export class CircleApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class CircleApiAdapter {
  private static readonly origin = "https://app.circle.so";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: CircleCredentials) {
    const community = await this.getCommunity(credentials);
    return { tokenValid: true, community: community.community };
  }

  async getCommunity(credentials: CircleCredentials) {
    const body = await this.send(credentials, "GET", "/api/admin/v2/community");
    return { community: this.community(body) };
  }

  async listSpaces(credentials: CircleCredentials, input: JsonObject) {
    const body = await this.getCollection(
      credentials,
      "/api/admin/v2/spaces",
      input,
    );
    return this.collection(body, (value) => this.space(value));
  }

  async getSpace(credentials: CircleCredentials, input: JsonObject) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const body = await this.send(
      credentials,
      "GET",
      `/api/admin/v2/spaces/${spaceId}`,
    );
    return { space: this.space(body) };
  }

  async listPosts(credentials: CircleCredentials, input: JsonObject) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const query = this.pageQuery(input);
    query.set("space_id", String(spaceId));
    const status = this.enum(input.status, "status", [
      "draft",
      "published",
      "scheduled",
      "all",
    ]);
    query.set("status", status ?? "published");
    const body = await this.send(
      credentials,
      "GET",
      `/api/admin/v2/posts?${query}`,
    );
    return this.collection(body, (value) => this.post(value));
  }

  async getPost(credentials: CircleCredentials, input: JsonObject) {
    const postId = this.id(input.postId, "postId");
    const body = await this.send(
      credentials,
      "GET",
      `/api/admin/v2/posts/${postId}`,
    );
    return { post: this.post(body) };
  }

  async listMembers(credentials: CircleCredentials, input: JsonObject) {
    const query = this.pageQuery(input);
    const status = this.enum(input.status, "status", [
      "active",
      "inactive",
      "all",
    ]);
    query.set("status", status ?? "active");
    const body = await this.send(
      credentials,
      "GET",
      `/api/admin/v2/community_members?${query}`,
    );
    return this.collection(body, (value) => this.member(value));
  }

  async getMember(credentials: CircleCredentials, input: JsonObject) {
    const memberId = this.id(input.memberId, "memberId");
    const body = await this.send(
      credentials,
      "GET",
      `/api/admin/v2/community_members/${memberId}`,
    );
    return { member: this.member(body) };
  }

  async listAccessGroups(credentials: CircleCredentials, input: JsonObject) {
    const body = await this.getCollection(
      credentials,
      "/api/admin/v2/access_groups",
      input,
    );
    return this.collection(body, (value) => this.accessGroup(value));
  }

  async listMemberAccessGroups(
    credentials: CircleCredentials,
    input: JsonObject,
  ) {
    const memberId = this.id(input.memberId, "memberId");
    const query = this.pageQuery(input);
    const body = await this.send(
      credentials,
      "GET",
      `/api/admin/v2/community_members/${memberId}/access_groups?${query}`,
    );
    return {
      memberId,
      ...this.collection(body, (value) => this.accessGroup(value)),
    };
  }

  async addSpaceMember(credentials: CircleCredentials, input: JsonObject) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const email = this.email(input.email);
    await this.send(credentials, "POST", "/api/admin/v2/space_members", {
      email,
      space_id: spaceId,
    });
    return { spaceId, email, added: true };
  }

  async removeSpaceMember(credentials: CircleCredentials, input: JsonObject) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const email = this.email(input.email);
    const query = new URLSearchParams({ email, space_id: String(spaceId) });
    await this.send(
      credentials,
      "DELETE",
      `/api/admin/v2/space_members?${query}`,
    );
    return { spaceId, email, removed: true };
  }

  async addAccessGroupMember(
    credentials: CircleCredentials,
    input: JsonObject,
  ) {
    const accessGroupId = this.id(input.accessGroupId, "accessGroupId");
    const email = this.email(input.email);
    await this.send(
      credentials,
      "POST",
      `/api/admin/v2/access_groups/${accessGroupId}/community_members`,
      { email },
    );
    return { accessGroupId, email, added: true };
  }

  async removeAccessGroupMember(
    credentials: CircleCredentials,
    input: JsonObject,
  ) {
    const accessGroupId = this.id(input.accessGroupId, "accessGroupId");
    const email = this.email(input.email);
    const query = new URLSearchParams({ email });
    await this.send(
      credentials,
      "DELETE",
      `/api/admin/v2/access_groups/${accessGroupId}/community_members?${query}`,
    );
    return { accessGroupId, email, removed: true };
  }

  private async getCollection(
    credentials: CircleCredentials,
    path: string,
    input: JsonObject,
  ) {
    const query = this.pageQuery(input);
    return await this.send(credentials, "GET", `${path}?${query}`);
  }

  private async send(
    credentials: CircleCredentials,
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: JsonObject,
  ): Promise<JsonObject> {
    const token = credentials.apiToken.trim();
    if (!token)
      throw new CircleApiError(
        "credential_missing",
        "Circle Admin API token is missing.",
      );
    const url = new URL(path, CircleApiAdapter.origin);
    if (
      url.origin !== CircleApiAdapter.origin ||
      !url.pathname.startsWith("/api/admin/v2/")
    )
      throw new CircleApiError(
        "policy_blocked",
        "Circle request left the fixed Admin API v2 boundary.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new CircleApiError(
        "provider_unavailable",
        "Circle is temporarily unavailable.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000)
      throw new CircleApiError(
        "provider_validation_error",
        "Circle response exceeded the safe size limit.",
      );
    let parsed: unknown = {};
    try {
      parsed = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      throw new CircleApiError(
        "provider_validation_error",
        "Circle returned an invalid response.",
      );
    }
    const result = this.object(parsed) ?? {};
    if (!response.ok)
      throw new CircleApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Circle Admin API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return result;
  }

  private pageQuery(input: JsonObject) {
    return new URLSearchParams({
      page: String(this.integer(input.page, 1, 10_000, 1)),
      per_page: String(this.integer(input.maxResults, 1, 25, 25)),
    });
  }

  private collection<T>(body: JsonObject, map: (value: unknown) => T) {
    return {
      items: this.array(body.records).slice(0, 25).map(map),
      page: this.integerScalar(body.page),
      perPage: this.integerScalar(body.per_page),
      hasNextPage: body.has_next_page === true,
      count: this.integerScalar(body.count),
      pageCount: this.integerScalar(body.page_count),
    };
  }

  private community(value: unknown) {
    const outer = this.object(value) ?? {};
    const item = this.object(outer.community) ?? outer;
    const prefs = this.object(item.prefs) ?? {};
    return {
      id: this.integerScalar(item.id),
      name: this.scalar(item.name),
      slug: this.scalar(item.slug),
      locale: this.scalar(item.locale),
      isPrivate: this.boolean(item.is_private),
      whiteLabel: this.boolean(item.white_label),
      hasPosts: this.boolean(prefs.has_posts),
      hasSpaces: this.boolean(prefs.has_spaces),
      createdAt: this.scalar(item.created_at),
    };
  }

  private space(value: unknown) {
    const item = this.object(value) ?? {};
    const group = this.object(item.space_group) ?? {};
    return {
      id: this.integerScalar(item.id),
      name: this.scalar(item.name),
      slug: this.scalar(item.slug),
      spaceType: this.scalar(item.space_type),
      isPrivate: this.boolean(item.is_private),
      hiddenFromNonMembers: this.boolean(item.is_hidden_from_non_members),
      hidden: this.boolean(item.is_hidden),
      postsDisabled: this.boolean(item.is_post_disabled),
      memberCountHidden: this.boolean(item.hide_members_count),
      spaceGroup: {
        id: this.integerScalar(group.id),
        name: this.scalar(group.name),
      },
    };
  }

  private post(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.integerScalar(item.id),
      name: this.scalar(item.name),
      slug: this.scalar(item.slug),
      status: this.scalar(item.status),
      spaceId: this.integerScalar(item.space_id),
      spaceName: this.scalar(item.space_name),
      authorName: this.scalar(item.user_name),
      commentsCount: this.integerScalar(item.comments_count),
      likesCount: this.integerScalar(item.likes_count),
      publishedAt: this.scalar(item.published_at),
      createdAt: this.scalar(item.created_at),
      updatedAt: this.scalar(item.updated_at),
      flaggedForApproval: Boolean(item.flagged_for_approval_at),
      unresolvedFlaggedReportsCount: this.integerScalar(
        item.unresolved_flagged_reports_count,
      ),
    };
  }

  private member(value: unknown) {
    const item = this.object(value) ?? {};
    const roles = this.object(item.roles);
    return {
      id: this.integerScalar(item.id),
      name: this.scalar(item.name),
      email: this.scalar(item.email),
      headline: this.scalar(item.headline),
      active: this.boolean(item.active),
      publicUid: this.scalar(item.public_uid),
      admin: roles ? this.boolean(roles.admin) : null,
      moderator: roles ? this.boolean(roles.moderator) : null,
      postsCount: this.integerScalar(item.posts_count),
      commentsCount: this.integerScalar(item.comments_count),
      lastSeenAt: this.scalar(item.last_seen_at),
      createdAt: this.scalar(item.created_at),
      updatedAt: this.scalar(item.updated_at),
    };
  }

  private accessGroup(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.integerScalar(item.id),
      name: this.scalar(item.name),
      description: this.scalar(item.description),
      status: this.scalar(item.status),
      createdAt: this.scalar(item.created_at),
      updatedAt: this.scalar(item.updated_at),
    };
  }

  private id(value: unknown, field: string) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < 1)
      throw new CircleApiError(
        "provider_validation_error",
        `Circle ${field} is invalid.`,
      );
    return number;
  }

  private email(value: unknown) {
    if (
      typeof value !== "string" ||
      value.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    )
      throw new CircleApiError(
        "provider_validation_error",
        "Circle member email is invalid.",
      );
    return value.toLowerCase();
  }

  private enum(value: unknown, field: string, allowed: string[]) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !allowed.includes(value))
      throw new CircleApiError(
        "provider_validation_error",
        `Circle ${field} is invalid.`,
      );
    return value;
  }

  private integer(
    value: unknown,
    minimum: number,
    maximum: number,
    fallback: number,
  ) {
    if (value === undefined || value === null) return fallback;
    if (
      !Number.isInteger(value) ||
      Number(value) < minimum ||
      Number(value) > maximum
    )
      throw new CircleApiError(
        "provider_validation_error",
        "Circle pagination is invalid.",
      );
    return Number(value);
  }

  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private scalar(value: unknown): string | null {
    return typeof value === "string" || typeof value === "number"
      ? String(value).slice(0, 2_000)
      : null;
  }

  private boolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
  }

  private integerScalar(value: unknown): number | null {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(number) ? number : null;
  }
}
