import { isIP } from "node:net";

import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type VanillaForumsCredentials = {
  baseUrl: string;
  accessToken: string;
};

export class VanillaForumsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class VanillaForumsApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: VanillaForumsCredentials) {
    const actor = await this.getCurrentUser(credentials);
    return { tokenValid: true, actor: actor.user };
  }

  async getCurrentUser(credentials: VanillaForumsCredentials) {
    const query = new URLSearchParams({
      fields: "userID,name,admin,moderator,roles,rankID",
    });
    const { body } = await this.send(credentials, `/api/v2/users/me?${query}`);
    return { user: this.user(body) };
  }

  async listCategories(
    credentials: VanillaForumsCredentials,
    input: JsonObject,
  ) {
    return this.list(
      credentials,
      "/api/v2/categories",
      "categoryID,name,urlcode,parentCategoryID,countDiscussions,countComments,displayAs,isArchived",
      input,
      (value) => this.category(value),
    );
  }

  async listBadges(credentials: VanillaForumsCredentials, input: JsonObject) {
    return this.list(
      credentials,
      "/api/v2/badges",
      "badgeID,name,enabled,points,categoryID",
      input,
      (value) => this.badge(value),
    );
  }

  async listDiscussions(
    credentials: VanillaForumsCredentials,
    input: JsonObject,
  ) {
    return this.list(
      credentials,
      "/api/v2/discussions",
      "discussionID,name,categoryID,type,status,dateInserted,dateUpdated,countComments,score,closed,sink",
      input,
      (value) => this.discussion(value),
    );
  }

  async listUsers(credentials: VanillaForumsCredentials, input: JsonObject) {
    return this.list(
      credentials,
      "/api/v2/users",
      "userID,name,admin,moderator,dateInserted,countDiscussions,countComments,points,rankID",
      input,
      (value) => this.user(value),
    );
  }

  private async list<T>(
    credentials: VanillaForumsCredentials,
    path: string,
    fields: string,
    input: JsonObject,
    map: (value: unknown) => T,
  ) {
    const page = this.integer(input.page, 1, 10_000, 1);
    const limit = this.integer(input.maxResults, 1, 25, 25);
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      fields,
    });
    const { body, headers } = await this.send(credentials, `${path}?${query}`);
    const values = this.array(body).slice(0, limit);
    return {
      items: values.map(map),
      page,
      limit,
      returned: values.length,
      hasNextPage: this.hasNextPage(headers),
    };
  }

  private async send(
    credentials: VanillaForumsCredentials,
    path: string,
  ): Promise<{ body: unknown; headers: Headers }> {
    const origin = this.origin(credentials.baseUrl);
    const accessToken = credentials.accessToken.trim();
    if (!accessToken || accessToken.length > 8_192)
      throw new VanillaForumsApiError(
        "credential_missing",
        "Vanilla personal access token is missing or invalid.",
      );
    const url = new URL(path, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/api/v2/"))
      throw new VanillaForumsApiError(
        "policy_blocked",
        "Vanilla request left the exactly configured community API boundary.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new VanillaForumsApiError(
        "provider_unavailable",
        "Vanilla is temporarily unavailable.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000)
      throw new VanillaForumsApiError(
        "provider_validation_error",
        "Vanilla response exceeded the safe size limit.",
      );
    let body: unknown = {};
    try {
      body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      throw new VanillaForumsApiError(
        "provider_validation_error",
        "Vanilla returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new VanillaForumsApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Vanilla API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return { body, headers: response.headers };
  }

  private origin(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new VanillaForumsApiError(
        "credential_missing",
        "Vanilla community URL is missing or invalid.",
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
      throw new VanillaForumsApiError(
        "credential_missing",
        "Vanilla community URL must be a public HTTPS origin without a path.",
      );
    return url.origin;
  }

  private hasNextPage(headers: Headers) {
    return (
      Boolean(headers.get("x-app-page-next-url")) ||
      /<[^>]+>;\s*rel="next"/i.test(headers.get("link") ?? "") ||
      headers.get("paging-next") === "true"
    );
  }

  private user(value: unknown) {
    const item = this.object(value);
    return {
      id: this.integerScalar(item.userID),
      name: this.scalar(item.name),
      admin: this.boolean(item.admin),
      moderator: this.boolean(item.moderator),
      roleNames: this.array(item.roles)
        .map(
          (role) =>
            this.scalar(this.objectOrNull(role)?.name) ?? this.scalar(role),
        )
        .filter((role): role is string => Boolean(role))
        .slice(0, 25),
      rankId: this.integerScalar(item.rankID),
      joinedAt: this.scalar(item.dateInserted),
      discussionCount: this.integerScalar(item.countDiscussions),
      commentCount: this.integerScalar(item.countComments),
      points: this.integerScalar(item.points),
    };
  }

  private category(value: unknown) {
    const item = this.object(value);
    return {
      id: this.integerScalar(item.categoryID),
      name: this.scalar(item.name),
      slug: this.scalar(item.urlcode),
      parentCategoryId: this.integerScalar(item.parentCategoryID),
      discussionCount: this.integerScalar(item.countDiscussions),
      commentCount: this.integerScalar(item.countComments),
      displayAs: this.scalar(item.displayAs),
      archived: this.boolean(item.isArchived),
    };
  }

  private badge(value: unknown) {
    const item = this.object(value);
    return {
      id: this.integerScalar(item.badgeID),
      name: this.scalar(item.name),
      enabled: this.boolean(item.enabled),
      points: this.integerScalar(item.points),
      categoryId: this.integerScalar(item.categoryID),
    };
  }

  private discussion(value: unknown) {
    const item = this.object(value);
    return {
      id: this.integerScalar(item.discussionID),
      name: this.scalar(item.name),
      categoryId: this.integerScalar(item.categoryID),
      type: this.scalar(item.type),
      status: this.scalar(item.status),
      createdAt: this.scalar(item.dateInserted),
      updatedAt: this.scalar(item.dateUpdated),
      commentCount: this.integerScalar(item.countComments),
      score: this.integerScalar(item.score),
      closed: this.boolean(item.closed),
      sunk: this.boolean(item.sink),
    };
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
      throw new VanillaForumsApiError(
        "provider_validation_error",
        "Vanilla pagination input is invalid.",
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
    return typeof value === "boolean"
      ? value
      : value === 1 || value === "1" || value === "true"
        ? true
        : value === 0 || value === "0" || value === "false"
          ? false
          : null;
  }
}
