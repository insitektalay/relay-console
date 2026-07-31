import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type MightyNetworksCredentials = {
  apiToken: string;
  networkId: string;
};

export class MightyNetworksApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class MightyNetworksApiAdapter {
  private static readonly origin = "https://api.mn.co";
  private static readonly userAgent =
    "RelayConsole/1.0 (+https://relayconsole.work)";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: MightyNetworksCredentials) {
    const result = await this.getNetwork(credentials);
    return { tokenValid: true, network: result.network };
  }

  async getNetwork(credentials: MightyNetworksCredentials) {
    const body = await this.send(
      credentials,
      "GET",
      `${this.base(credentials)}/`,
    );
    return { network: this.network(this.object(body.network) ?? body) };
  }

  async listSpaces(credentials: MightyNetworksCredentials, input: JsonObject) {
    const body = await this.list(
      credentials,
      `${this.base(credentials)}/spaces`,
      input,
    );
    return this.collection(body, (value) => this.space(value));
  }

  async getSpace(credentials: MightyNetworksCredentials, input: JsonObject) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const body = await this.send(
      credentials,
      "GET",
      `${this.base(credentials)}/spaces/${spaceId}`,
    );
    return { space: this.space(this.object(body.space) ?? body) };
  }

  async listMembers(credentials: MightyNetworksCredentials, input: JsonObject) {
    const body = await this.list(
      credentials,
      `${this.base(credentials)}/members`,
      input,
    );
    return this.collection(body, (value) => this.member(value));
  }

  async getMember(credentials: MightyNetworksCredentials, input: JsonObject) {
    const memberId = this.id(input.memberId, "memberId");
    const body = await this.send(
      credentials,
      "GET",
      `${this.base(credentials)}/members/${memberId}`,
    );
    return { member: this.member(this.object(body.member) ?? body) };
  }

  async listPosts(credentials: MightyNetworksCredentials, input: JsonObject) {
    const query = this.pageQuery(input);
    if (input.spaceId !== undefined)
      query.set("space_id", String(this.id(input.spaceId, "spaceId")));
    const body = await this.send(
      credentials,
      "GET",
      `${this.base(credentials)}/posts?${query}`,
    );
    return this.collection(body, (value) => this.post(value));
  }

  async getPost(credentials: MightyNetworksCredentials, input: JsonObject) {
    const postId = this.id(input.postId, "postId");
    const body = await this.send(
      credentials,
      "GET",
      `${this.base(credentials)}/posts/${postId}`,
    );
    return { post: this.post(this.object(body.post) ?? body) };
  }

  async listSpaceMembers(
    credentials: MightyNetworksCredentials,
    input: JsonObject,
  ) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const body = await this.list(
      credentials,
      `${this.base(credentials)}/spaces/${spaceId}/members`,
      input,
    );
    return { spaceId, ...this.collection(body, (value) => this.member(value)) };
  }

  async addSpaceMember(
    credentials: MightyNetworksCredentials,
    input: JsonObject,
  ) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const userId = this.id(input.userId, "userId");
    const query = new URLSearchParams({ user_id: String(userId) });
    await this.send(
      credentials,
      "POST",
      `${this.base(credentials)}/spaces/${spaceId}/members?${query}`,
    );
    return { spaceId, userId, added: true };
  }

  async removeSpaceMember(
    credentials: MightyNetworksCredentials,
    input: JsonObject,
  ) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const userId = this.id(input.userId, "userId");
    await this.send(
      credentials,
      "DELETE",
      `${this.base(credentials)}/spaces/${spaceId}/members/${userId}/`,
    );
    return { spaceId, userId, removed: true };
  }

  private async list(
    credentials: MightyNetworksCredentials,
    path: string,
    input: JsonObject,
  ) {
    return await this.send(
      credentials,
      "GET",
      `${path}?${this.pageQuery(input)}`,
    );
  }

  private base(credentials: MightyNetworksCredentials) {
    const networkId = credentials.networkId.trim();
    if (!/^(?:[1-9]\d{0,18}|[a-z][a-z0-9-]{0,99})$/.test(networkId))
      throw new MightyNetworksApiError(
        "credential_missing",
        "Mighty Networks network ID or subdomain is missing or invalid.",
      );
    return `/admin/v1/networks/${encodeURIComponent(networkId)}`;
  }

  private async send(
    credentials: MightyNetworksCredentials,
    method: "GET" | "POST" | "DELETE",
    path: string,
  ): Promise<JsonObject> {
    const token = credentials.apiToken.trim();
    if (!token)
      throw new MightyNetworksApiError(
        "credential_missing",
        "Mighty Networks Admin API token is missing.",
      );
    const url = new URL(path, MightyNetworksApiAdapter.origin);
    if (
      url.origin !== MightyNetworksApiAdapter.origin ||
      !url.pathname.startsWith("/admin/v1/networks/")
    )
      throw new MightyNetworksApiError(
        "policy_blocked",
        "Mighty Networks request left the fixed Admin API boundary.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": MightyNetworksApiAdapter.userAgent,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new MightyNetworksApiError(
        "provider_unavailable",
        "Mighty Networks is temporarily unavailable.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000)
      throw new MightyNetworksApiError(
        "provider_validation_error",
        "Mighty Networks response exceeded the safe size limit.",
      );
    let parsed: unknown = {};
    try {
      parsed = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      throw new MightyNetworksApiError(
        "provider_validation_error",
        "Mighty Networks returned an invalid response.",
      );
    }
    const body = this.object(parsed) ?? {};
    if (!response.ok)
      throw new MightyNetworksApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Mighty Networks Admin API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private pageQuery(input: JsonObject) {
    return new URLSearchParams({
      page: String(this.integer(input.page, 1, 10_000, 1)),
      per_page: String(this.integer(input.maxResults, 1, 25, 25)),
    });
  }

  private collection<T>(body: JsonObject, map: (value: unknown) => T) {
    const meta = this.object(body.meta) ?? {};
    const values = this.array(body.items).length
      ? this.array(body.items)
      : this.array(body.data);
    return {
      items: values.slice(0, 25).map(map),
      page: this.integerScalar(meta.current_page),
      totalPages: this.integerScalar(meta.total_pages),
      totalCount: this.integerScalar(meta.total_count),
      perPage: this.integerScalar(meta.per_page),
    };
  }

  private network(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.scalar(item.id),
      name: this.scalar(item.name) ?? this.scalar(item.title),
      domain: this.scalar(item.domain),
      subdomain: this.scalar(item.subdomain),
      createdAt: this.scalar(item.created_at),
      updatedAt: this.scalar(item.updated_at),
    };
  }

  private space(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.integerScalar(item.id),
      name: this.scalar(item.name),
      collectionId: this.integerScalar(item.collection_id),
      visibility: this.scalar(item.visibility),
      createdAt: this.scalar(item.created_at),
      updatedAt: this.scalar(item.updated_at),
    };
  }

  private member(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.integerScalar(item.id),
      userId: this.integerScalar(item.user_id) ?? this.integerScalar(item.id),
      email: this.scalar(item.email),
      firstName: this.scalar(item.first_name),
      lastName: this.scalar(item.last_name),
      memberType: this.scalar(item.member_type),
      role: this.scalar(item.role),
      status: this.scalar(item.status),
      createdAt: this.scalar(item.created_at),
      updatedAt: this.scalar(item.updated_at),
    };
  }

  private post(value: unknown) {
    const item = this.object(value) ?? {};
    const author = this.object(item.author) ?? {};
    return {
      id: this.integerScalar(item.id),
      title: this.scalar(item.title) ?? this.scalar(item.name),
      status: this.scalar(item.status),
      postType: this.scalar(item.post_type) ?? this.scalar(item.type),
      spaceId: this.integerScalar(item.space_id),
      authorId:
        this.integerScalar(item.author_id) ?? this.integerScalar(author.id),
      authorName: this.scalar(item.author_name) ?? this.scalar(author.name),
      commentsCount: this.integerScalar(item.comments_count),
      reactionsCount:
        this.integerScalar(item.reactions_count) ??
        this.integerScalar(item.likes_count),
      createdAt: this.scalar(item.created_at),
      updatedAt: this.scalar(item.updated_at),
      publishedAt: this.scalar(item.published_at),
    };
  }

  private id(value: unknown, field: string) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < 1)
      throw new MightyNetworksApiError(
        "provider_validation_error",
        `Mighty Networks ${field} is invalid.`,
      );
    return number;
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
      throw new MightyNetworksApiError(
        "provider_validation_error",
        "Mighty Networks pagination is invalid.",
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

  private integerScalar(value: unknown): number | null {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(number) ? number : null;
  }
}
