import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type BettermodeCredentials = {
  region: "us" | "eu" | string;
  networkId: string;
  memberId: string;
  accessToken: string;
};

export class BettermodeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const NETWORK_QUERY = `query RelayBettermodeNetwork {
  network {
    id name domain locale membership visibility status membersCount
  }
}`;
const ACTOR_QUERY = `query RelayBettermodeActor {
  authMember {
    id name username status teammate createdAt role { id name }
  }
}`;
const SPACES_QUERY = `query RelayBettermodeSpaces($limit: Int!, $offset: Int!) {
  spaces(limit: $limit, offset: $offset) {
    nodes {
      id name slug type layout hidden inviteOnly private membersCount postsCount createdAt updatedAt
    }
    totalCount
  }
}`;
const MEMBERS_QUERY = `query RelayBettermodeMembers($limit: Int!, $offset: Int!) {
  members(limit: $limit, offset: $offset) {
    nodes {
      id name username status teammate score createdAt role { id name }
    }
    totalCount
  }
}`;
const SPACE_MEMBERS_QUERY = `query RelayBettermodeSpaceMembers($spaceId: ID!, $limit: Int!, $offset: Int!) {
  spaceMembers(spaceId: $spaceId, limit: $limit, offset: $offset) {
    nodes {
      member { id name username status teammate }
      role { id name }
    }
    totalCount
  }
}`;
const POSTS_QUERY = `query RelayBettermodePosts($spaceIds: [ID!], $limit: Int!, $offset: Int!) {
  posts(spaceIds: $spaceIds, limit: $limit, offset: $offset) {
    nodes {
      id title spaceId status postTypeId createdAt updatedAt publishedAt reactionsCount repliesCount totalRepliesCount locked isAnonymous isHidden
    }
    totalCount
  }
}`;
const ADD_SPACE_MEMBER_MUTATION = `mutation RelayBettermodeAddSpaceMember($spaceId: ID!, $memberId: ID!) {
  addSpaceMembers(spaceId: $spaceId, input: [{ memberId: $memberId }]) {
    member { id }
    space { id }
    role { id name }
  }
}`;
const REMOVE_SPACE_MEMBER_MUTATION = `mutation RelayBettermodeRemoveSpaceMember($spaceId: ID!, $memberId: ID!) {
  removeSpaceMembers(spaceId: $spaceId, memberIds: [$memberId]) { status }
}`;

export class BettermodeApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: BettermodeCredentials) {
    const [network, actor] = await Promise.all([
      this.getNetwork(credentials),
      this.getCurrentMember(credentials),
    ]);
    return { tokenValid: true, network: network.network, actor: actor.member };
  }

  async getNetwork(credentials: BettermodeCredentials) {
    const data = await this.send(credentials, NETWORK_QUERY, {});
    const network = this.network(data.network);
    const expected = this.id(credentials.networkId, "Network ID", true);
    if (network.id !== expected)
      throw new BettermodeApiError(
        "policy_blocked",
        "Bettermode token is not bound to the exactly configured Network.",
        403,
      );
    return { network };
  }

  async getCurrentMember(credentials: BettermodeCredentials) {
    const data = await this.send(credentials, ACTOR_QUERY, {});
    const member = this.member(data.authMember);
    const expected = this.id(credentials.memberId, "member ID", true);
    if (member.id !== expected)
      throw new BettermodeApiError(
        "policy_blocked",
        "Bettermode token does not represent the exactly configured member.",
        403,
      );
    return { member };
  }

  async listSpaces(credentials: BettermodeCredentials, input: JsonObject) {
    const page = this.page(input);
    const limit = this.limit(input);
    const data = await this.send(credentials, SPACES_QUERY, {
      limit,
      offset: (page - 1) * limit,
    });
    return this.connection(data.spaces, page, limit, (value) =>
      this.space(value),
    );
  }

  async listMembers(credentials: BettermodeCredentials, input: JsonObject) {
    const page = this.page(input);
    const limit = this.limit(input);
    const data = await this.send(credentials, MEMBERS_QUERY, {
      limit,
      offset: (page - 1) * limit,
    });
    return this.connection(data.members, page, limit, (value) =>
      this.member(value),
    );
  }

  async listSpaceMembers(
    credentials: BettermodeCredentials,
    input: JsonObject,
  ) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const page = this.page(input);
    const limit = this.limit(input);
    const data = await this.send(credentials, SPACE_MEMBERS_QUERY, {
      spaceId,
      limit,
      offset: (page - 1) * limit,
    });
    return {
      spaceId,
      ...this.connection(data.spaceMembers, page, limit, (value) =>
        this.spaceMember(value),
      ),
    };
  }

  async listPosts(credentials: BettermodeCredentials, input: JsonObject) {
    const spaceId =
      input.spaceId == null ? null : this.id(input.spaceId, "spaceId");
    const page = this.page(input);
    const limit = this.limit(input);
    const data = await this.send(credentials, POSTS_QUERY, {
      spaceIds: spaceId ? [spaceId] : null,
      limit,
      offset: (page - 1) * limit,
    });
    return {
      spaceId,
      ...this.connection(data.posts, page, limit, (value) => this.post(value)),
    };
  }

  async addSpaceMember(credentials: BettermodeCredentials, input: JsonObject) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const memberId = this.id(input.memberId, "memberId");
    const data = await this.send(credentials, ADD_SPACE_MEMBER_MUTATION, {
      spaceId,
      memberId,
    });
    const added = this.array(data.addSpaceMembers).some((value) => {
      const item = this.object(value);
      return (
        this.scalar(this.object(item.member).id) === memberId &&
        this.scalar(this.object(item.space).id) === spaceId
      );
    });
    if (!added)
      throw new BettermodeApiError(
        "provider_validation_error",
        "Bettermode did not confirm the exact Space membership addition.",
      );
    return { spaceId, memberId, added: true };
  }

  async removeSpaceMember(
    credentials: BettermodeCredentials,
    input: JsonObject,
  ) {
    const spaceId = this.id(input.spaceId, "spaceId");
    const memberId = this.id(input.memberId, "memberId");
    const data = await this.send(credentials, REMOVE_SPACE_MEMBER_MUTATION, {
      spaceId,
      memberId,
    });
    const result = this.object(data.removeSpaceMembers);
    const status = this.scalar(result.status);
    if (!status)
      throw new BettermodeApiError(
        "provider_validation_error",
        "Bettermode did not confirm the exact Space membership removal.",
      );
    return { spaceId, memberId, removed: true };
  }

  private async send(
    credentials: BettermodeCredentials,
    query: string,
    variables: JsonObject,
  ): Promise<JsonObject> {
    const endpoint = this.endpoint(credentials.region);
    this.id(credentials.networkId, "Network ID", true);
    this.id(credentials.memberId, "member ID", true);
    const token = credentials.accessToken.trim();
    if (!token || token.length > 8_192)
      throw new BettermodeApiError(
        "credential_missing",
        "Bettermode access token is missing or invalid.",
      );
    let response: Response;
    try {
      response = await this.request(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new BettermodeApiError(
        "provider_unavailable",
        "Bettermode is temporarily unavailable.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000)
      throw new BettermodeApiError(
        "provider_validation_error",
        "Bettermode response exceeded the safe size limit.",
      );
    let parsed: JsonObject;
    try {
      parsed = this.object(raw.length ? JSON.parse(raw.toString("utf8")) : {});
    } catch {
      throw new BettermodeApiError(
        "provider_validation_error",
        "Bettermode returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new BettermodeApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Bettermode GraphQL request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    const errors = this.array(parsed.errors);
    if (errors.length) {
      const codes = errors.map((value) =>
        this.scalar(this.object(this.object(value).extensions).code),
      );
      throw new BettermodeApiError(
        codes.some((code) => code === "UNAUTHENTICATED")
          ? "token_expired"
          : codes.some((code) => code === "FORBIDDEN")
            ? "insufficient_scope"
            : codes.some((code) => code?.includes("RATE"))
              ? "provider_rate_limited"
              : "provider_validation_error",
        "Bettermode GraphQL request failed.",
        200,
        { retryAfter: response.headers.get("retry-after") },
      );
    }
    const data = this.objectOrNull(parsed.data);
    if (!data)
      throw new BettermodeApiError(
        "provider_validation_error",
        "Bettermode returned an invalid GraphQL response.",
      );
    return data;
  }

  private endpoint(region: string) {
    const normalized = region.trim().toLowerCase();
    if (normalized === "us") return "https://api.bettermode.com/";
    if (normalized === "eu") return "https://api.bettermode.de/";
    throw new BettermodeApiError(
      "credential_missing",
      "Bettermode region must be exactly us or eu.",
    );
  }

  private connection<T>(
    value: unknown,
    page: number,
    limit: number,
    map: (value: unknown) => T,
  ) {
    const connection = this.object(value);
    const nodes = this.array(connection.nodes).slice(0, limit);
    const totalCount = this.integerScalar(connection.totalCount);
    return {
      items: nodes.map(map),
      page,
      limit,
      returned: nodes.length,
      totalCount,
      hasNextPage:
        totalCount == null ? nodes.length === limit : page * limit < totalCount,
    };
  }

  private network(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(item.id),
      name: this.scalar(item.name),
      domain: this.scalar(item.domain),
      locale: this.scalar(item.locale),
      membership: this.scalar(item.membership),
      visibility: this.scalar(item.visibility),
      status: this.scalar(item.status),
      memberCount: this.integerScalar(item.membersCount),
    };
  }

  private member(value: unknown) {
    const item = this.object(value);
    const role = this.object(item.role);
    return {
      id: this.scalar(item.id),
      name: this.scalar(item.name),
      username: this.scalar(item.username),
      status: this.scalar(item.status),
      teammate: this.boolean(item.teammate),
      score: this.integerScalar(item.score),
      createdAt: this.scalar(item.createdAt),
      role: { id: this.scalar(role.id), name: this.scalar(role.name) },
    };
  }

  private space(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(item.id),
      name: this.scalar(item.name),
      slug: this.scalar(item.slug),
      type: this.scalar(item.type),
      layout: this.scalar(item.layout),
      hidden: this.boolean(item.hidden),
      inviteOnly: this.boolean(item.inviteOnly),
      private: this.boolean(item.private),
      memberCount: this.integerScalar(item.membersCount),
      postCount: this.integerScalar(item.postsCount),
      createdAt: this.scalar(item.createdAt),
      updatedAt: this.scalar(item.updatedAt),
    };
  }

  private spaceMember(value: unknown) {
    const item = this.object(value);
    const member = this.object(item.member);
    const role = this.object(item.role);
    return {
      member: {
        id: this.scalar(member.id),
        name: this.scalar(member.name),
        username: this.scalar(member.username),
        status: this.scalar(member.status),
        teammate: this.boolean(member.teammate),
      },
      role: { id: this.scalar(role.id), name: this.scalar(role.name) },
    };
  }

  private post(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(item.id),
      title: this.scalar(item.title),
      spaceId: this.scalar(item.spaceId),
      status: this.scalar(item.status),
      postTypeId: this.scalar(item.postTypeId),
      createdAt: this.scalar(item.createdAt),
      updatedAt: this.scalar(item.updatedAt),
      publishedAt: this.scalar(item.publishedAt),
      reactionCount: this.integerScalar(item.reactionsCount),
      replyCount: this.integerScalar(item.repliesCount),
      totalReplyCount: this.integerScalar(item.totalRepliesCount),
      locked: this.boolean(item.locked),
      anonymous: this.boolean(item.isAnonymous),
      hidden: this.boolean(item.isHidden),
    };
  }

  private id(value: unknown, field: string, credential = false) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
      throw new BettermodeApiError(
        credential ? "credential_missing" : "provider_validation_error",
        `Bettermode ${field} is invalid.`,
      );
    return value;
  }

  private page(input: JsonObject) {
    return this.integer(input.page, 1, 10_000, 1);
  }

  private limit(input: JsonObject) {
    return this.integer(input.maxResults, 1, 25, 25);
  }

  private integer(
    value: unknown,
    minimum: number,
    maximum: number,
    fallback: number,
  ) {
    if (value == null) return fallback;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < minimum || number > maximum)
      throw new BettermodeApiError(
        "provider_validation_error",
        "Bettermode pagination input is invalid.",
      );
    return number;
  }

  private object(value: unknown): JsonObject {
    return this.objectOrNull(value) ?? {};
  }

  private objectOrNull(value: unknown): JsonObject | null {
    return value != null && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private scalar(value: unknown): string | null {
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : null;
  }

  private integerScalar(value: unknown): number | null {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(number) ? number : null;
  }

  private boolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
  }
}
