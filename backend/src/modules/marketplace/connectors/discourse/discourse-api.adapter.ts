import { isIP } from "node:net";

import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type DiscourseCredentials = {
  baseUrl: string;
  apiKey: string;
  apiUsername: string;
};

export class DiscourseApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class DiscourseApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: DiscourseCredentials) {
    const [actor, site] = await Promise.all([
      this.getCurrentUser(credentials),
      this.getSiteBasicInfo(credentials),
    ]);
    return { tokenValid: true, actor: actor.user, site: site.site };
  }

  async getSiteBasicInfo(credentials: DiscourseCredentials) {
    const body = await this.send(credentials, "GET", "/site/basic-info.json");
    return { site: this.site(body) };
  }

  async getCurrentUser(credentials: DiscourseCredentials) {
    const body = await this.send(credentials, "GET", "/session/current.json");
    const value = this.object(body.current_user);
    if (!value)
      throw new DiscourseApiError(
        "insufficient_scope",
        "Discourse did not authenticate the configured API username.",
        403,
      );
    return { user: this.user(value) };
  }

  async listCategories(credentials: DiscourseCredentials, input: JsonObject) {
    const query = new URLSearchParams({ include_subcategories: "true" });
    const body = await this.send(
      credentials,
      "GET",
      `/categories.json?${query}`,
    );
    const list = this.object(body.category_list) ?? {};
    return this.boundedCollection(this.array(list.categories), input, (value) =>
      this.category(value),
    );
  }

  async listTags(credentials: DiscourseCredentials, input: JsonObject) {
    const body = await this.send(credentials, "GET", "/tags.json");
    return this.boundedCollection(this.array(body.tags), input, (value) =>
      this.tag(value),
    );
  }

  async listTagGroups(credentials: DiscourseCredentials, input: JsonObject) {
    const body = await this.send(credentials, "GET", "/tag_groups.json");
    return this.boundedCollection(this.array(body.tag_groups), input, (value) =>
      this.tagGroup(value),
    );
  }

  async listGroups(credentials: DiscourseCredentials, input: JsonObject) {
    const body = await this.send(credentials, "GET", "/groups.json");
    return this.boundedCollection(this.array(body.groups), input, (value) =>
      this.group(value),
    );
  }

  async getGroup(credentials: DiscourseCredentials, input: JsonObject) {
    const groupName = this.name(input.groupName, "groupName");
    const body = await this.send(
      credentials,
      "GET",
      `/groups/${encodeURIComponent(groupName)}.json`,
    );
    return { group: this.group(this.object(body.group) ?? body) };
  }

  async listGroupMembers(credentials: DiscourseCredentials, input: JsonObject) {
    const groupName = this.name(input.groupName, "groupName");
    const body = await this.send(
      credentials,
      "GET",
      `/groups/${encodeURIComponent(groupName)}/members.json`,
    );
    const owners = this.array(body.owners);
    const ownerNames = new Set(
      owners
        .map((value) => this.scalar(this.object(value)?.username))
        .filter((value): value is string => Boolean(value)),
    );
    const values = [...owners, ...this.array(body.members)].filter(
      (value, index, all) => {
        const username = this.scalar(this.object(value)?.username);
        return (
          username != null &&
          all.findIndex(
            (candidate) =>
              this.scalar(this.object(candidate)?.username) === username,
          ) === index
        );
      },
    );
    const result = this.boundedCollection(values, input, (value) => ({
      ...this.member(value),
      owner: ownerNames.has(this.scalar(this.object(value)?.username) ?? ""),
    }));
    const meta = this.object(body.meta) ?? {};
    return {
      groupName,
      ...result,
      total: this.integerScalar(meta.total),
      providerLimit: this.integerScalar(meta.limit),
      providerOffset: this.integerScalar(meta.offset),
    };
  }

  async listLatestTopics(credentials: DiscourseCredentials, input: JsonObject) {
    const maxResults = this.maxResults(input);
    const query = new URLSearchParams({
      page: String(this.integer(input.page, 0, 10_000, 0)),
      per_page: String(maxResults),
      order: "activity",
    });
    const body = await this.send(credentials, "GET", `/latest.json?${query}`);
    const list = this.object(body.topic_list) ?? {};
    return {
      items: this.array(list.topics)
        .slice(0, maxResults)
        .map((value) => this.topic(value)),
      page: this.integer(input.page, 0, 10_000, 0),
      perPage: this.integerScalar(list.per_page) ?? maxResults,
    };
  }

  async addGroupMember(credentials: DiscourseCredentials, input: JsonObject) {
    const groupId = this.id(input.groupId, "groupId");
    const username = this.name(input.username, "username");
    await this.send(credentials, "PUT", `/groups/${groupId}/members.json`, {
      usernames: username,
    });
    return { groupId, username, added: true };
  }

  async removeGroupMember(
    credentials: DiscourseCredentials,
    input: JsonObject,
  ) {
    const groupId = this.id(input.groupId, "groupId");
    const username = this.name(input.username, "username");
    await this.send(credentials, "DELETE", `/groups/${groupId}/members.json`, {
      usernames: username,
    });
    return { groupId, username, removed: true };
  }

  private async send(
    credentials: DiscourseCredentials,
    method: "GET" | "PUT" | "DELETE",
    path: string,
    body?: JsonObject,
  ): Promise<JsonObject> {
    const origin = this.origin(credentials.baseUrl);
    const apiKey = credentials.apiKey.trim();
    const apiUsername = this.name(credentials.apiUsername, "API username");
    if (!apiKey || apiKey.length > 4_096)
      throw new DiscourseApiError(
        "credential_missing",
        "Discourse API key is missing or invalid.",
      );
    const url = new URL(path, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/"))
      throw new DiscourseApiError(
        "policy_blocked",
        "Discourse request left the exactly configured site boundary.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          "Api-Key": apiKey,
          "Api-Username": apiUsername,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new DiscourseApiError(
        "provider_unavailable",
        "Discourse is temporarily unavailable.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000)
      throw new DiscourseApiError(
        "provider_validation_error",
        "Discourse response exceeded the safe size limit.",
      );
    let parsed: unknown = {};
    try {
      parsed = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      throw new DiscourseApiError(
        "provider_validation_error",
        "Discourse returned an invalid response.",
      );
    }
    const result = this.object(parsed) ?? {};
    if (!response.ok)
      throw new DiscourseApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Discourse API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return result;
  }

  private origin(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new DiscourseApiError(
        "credential_missing",
        "Discourse site URL is missing or invalid.",
      );
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !hostname.includes(".") ||
      isIP(hostname) !== 0 ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    )
      throw new DiscourseApiError(
        "credential_missing",
        "Discourse site URL must be a public HTTPS origin without a path.",
      );
    return url.origin;
  }

  private boundedCollection<T>(
    values: unknown[],
    input: JsonObject,
    map: (value: unknown) => T,
  ) {
    const maxResults = this.maxResults(input);
    return {
      items: values.slice(0, maxResults).map(map),
      returned: Math.min(values.length, maxResults),
      truncated: values.length > maxResults,
    };
  }

  private site(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      title: this.scalar(item.title),
      description: this.scalar(item.description),
      locale: this.scalar(item.locale),
      loginRequired: this.boolean(item.login_required),
    };
  }

  private user(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.integerScalar(item.id),
      username: this.scalar(item.username),
      name: this.scalar(item.name),
      trustLevel: this.integerScalar(item.trust_level),
      admin: this.boolean(item.admin),
      moderator: this.boolean(item.moderator),
    };
  }

  private category(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.integerScalar(item.id),
      name: this.scalar(item.name),
      slug: this.scalar(item.slug),
      topicCount: this.integerScalar(item.topic_count),
      postCount: this.integerScalar(item.post_count),
      position: this.integerScalar(item.position),
      parentCategoryId: this.integerScalar(item.parent_category_id),
      readRestricted: this.boolean(item.read_restricted),
    };
  }

  private tag(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.integerScalar(item.id),
      name: this.scalar(item.name) ?? this.scalar(item.text),
      count: this.integerScalar(item.count),
      targetTag: this.scalar(item.target_tag),
    };
  }

  private tagGroup(value: unknown) {
    const item = this.object(value) ?? {};
    const tags = this.array(item.tags).length
      ? this.array(item.tags).map((tag) => this.scalar(this.object(tag)?.name))
      : this.array(item.tag_names).map((tag) => this.scalar(tag));
    return {
      id: this.integerScalar(item.id),
      name: this.scalar(item.name),
      tagNames: tags.filter((tag): tag is string => Boolean(tag)).slice(0, 25),
      onePerTopic: this.boolean(item.one_per_topic),
    };
  }

  private group(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.integerScalar(item.id),
      name: this.scalar(item.name),
      displayName: this.scalar(item.display_name),
      title: this.scalar(item.title),
      userCount: this.integerScalar(item.user_count),
      automatic: this.boolean(item.automatic),
      primaryGroup: this.boolean(item.primary_group),
      visibilityLevel: this.integerScalar(item.visibility_level),
      publicAdmission: this.boolean(item.public_admission),
      publicExit: this.boolean(item.public_exit),
      createdAt: this.scalar(item.created_at),
      updatedAt: this.scalar(item.updated_at),
    };
  }

  private member(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.integerScalar(item.id),
      username: this.scalar(item.username),
      name: this.scalar(item.name),
      title: this.scalar(item.title),
      addedAt: this.scalar(item.added_at),
    };
  }

  private topic(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.integerScalar(item.id),
      title: this.scalar(item.title),
      slug: this.scalar(item.slug),
      categoryId: this.integerScalar(item.category_id),
      postsCount: this.integerScalar(item.posts_count),
      replyCount: this.integerScalar(item.reply_count),
      views: this.integerScalar(item.views),
      likeCount: this.integerScalar(item.like_count),
      pinned: this.boolean(item.pinned),
      closed: this.boolean(item.closed),
      archived: this.boolean(item.archived),
      visible: this.boolean(item.visible),
      createdAt: this.scalar(item.created_at),
      lastPostedAt: this.scalar(item.last_posted_at),
    };
  }

  private id(value: unknown, field: string) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < 1)
      throw new DiscourseApiError(
        "provider_validation_error",
        `Discourse ${field} is invalid.`,
      );
    return number;
  }

  private name(value: unknown, field: string) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_.-]{1,100}$/.test(value))
      throw new DiscourseApiError(
        field === "API username"
          ? "credential_missing"
          : "provider_validation_error",
        `Discourse ${field} is invalid.`,
      );
    return value;
  }

  private maxResults(input: JsonObject) {
    return this.integer(input.maxResults, 1, 25, 25);
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
      throw new DiscourseApiError(
        "provider_validation_error",
        "Discourse pagination is invalid.",
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

  private boolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
  }
}
