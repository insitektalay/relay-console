import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class WordPressComApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WordPressComApiAdapter {
  private readonly origin = "https://public-api.wordpress.com";

  async tokenInfo(accessToken: string, clientId: string) {
    if (!clientId)
      throw new WordPressComApiError(
        "connection_not_ready",
        "WordPress.com client configuration is incomplete.",
      );
    const url = new URL(`${this.origin}/oauth2/token-info`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("token", accessToken);
    const value = await this.requestUrl(
      accessToken,
      "GET",
      url,
      undefined,
      false,
    );
    const blogId = this.id(value.blog_id, "blog_id");
    const scopes = this.scopeList(value.scope);
    return {
      clientId: this.text(value.client_id),
      userId: this.id(value.user_id, "user_id"),
      blogId,
      scopes,
      providerRequestCount: 1,
    };
  }

  async listSites(accessToken: string, authorizedSiteId: string) {
    const value = await this.request(accessToken, "GET", "/rest/v1.1/me/sites");
    const all = this.array(value.sites).map((item) => this.site(item));
    const sites = all
      .filter((site) => site.id === authorizedSiteId)
      .slice(0, 1);
    if (!sites.length)
      throw new WordPressComApiError(
        "insufficient_scope",
        "The WordPress.com token no longer grants the connected site.",
        403,
      );
    return {
      sites,
      count: sites.length,
      authorizedSiteId,
      otherSitesExcluded: Math.max(0, all.length - sites.length),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async getSite(
    accessToken: string,
    authorizedSiteId: string,
    input: JsonObject,
  ) {
    const siteId = this.boundSite(input.siteId, authorizedSiteId);
    const value = await this.request(
      accessToken,
      "GET",
      `/rest/v1.1/sites/${this.segment(siteId)}`,
    );
    return { site: this.site(value), providerRequestCount: 1 };
  }

  async listPosts(
    accessToken: string,
    authorizedSiteId: string,
    input: JsonObject,
  ) {
    const siteId = this.boundSite(input.siteId, authorizedSiteId);
    const maxResults = this.limit(input.maxResults, 20, 25);
    const offset = this.offset(input.offset);
    const status = this.enumValue(
      input.status,
      ["publish", "private", "draft", "pending", "future"],
      "status",
    );
    const orderBy = this.enumValue(
      input.orderBy,
      ["date", "modified", "title", "ID"],
      "orderBy",
    );
    const order = this.enumValue(input.order, ["ASC", "DESC"], "order");
    const search = this.optionalText(input.search, 250, "search");
    const value = await this.request(
      accessToken,
      "GET",
      `/rest/v1.1/sites/${this.segment(siteId)}/posts`,
      {
        number: String(maxResults),
        offset: String(offset),
        context: "edit",
        ...(status ? { status } : {}),
        ...(orderBy ? { order_by: orderBy } : {}),
        ...(order ? { order } : {}),
        ...(search ? { search } : {}),
      },
    );
    const posts = this.array(value.posts)
      .slice(0, maxResults)
      .map((item) => this.post(item));
    return {
      siteId,
      posts,
      count: posts.length,
      found: this.numeric(value.found),
      offset,
      maxResults,
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async getPost(
    accessToken: string,
    authorizedSiteId: string,
    input: JsonObject,
  ) {
    const siteId = this.boundSite(input.siteId, authorizedSiteId);
    const postId = this.id(input.postId, "postId");
    const value = await this.request(
      accessToken,
      "GET",
      `/rest/v1.1/sites/${this.segment(siteId)}/posts/${this.segment(postId)}`,
      { context: "edit" },
    );
    return { siteId, post: this.post(value), providerRequestCount: 1 };
  }

  preparePostChange(authorizedSiteId: string, input: JsonObject) {
    const change = this.normalizedChange(authorizedSiteId, input);
    return {
      change,
      digest: this.digest(change),
      providerMutation: false,
      providerRequestCount: 0,
    };
  }

  async createDraft(
    accessToken: string,
    authorizedSiteId: string,
    input: JsonObject,
  ) {
    const change = this.normalizedCreate(authorizedSiteId, input);
    const value = await this.request(
      accessToken,
      "POST",
      `/rest/v1.1/sites/${this.segment(change.siteId)}/posts/new`,
      {},
      this.postBody(change, "draft"),
    );
    const post = this.post(value);
    if (post.status !== "draft")
      throw new WordPressComApiError(
        "provider_validation_error",
        "WordPress.com did not create a draft.",
      );
    return {
      operation: "create_draft",
      post,
      digest: this.digest(change),
      idempotencyKey: this.requiredText(
        input.idempotencyKey,
        180,
        "idempotencyKey",
      ),
      providerRequestCount: 1,
    };
  }

  async updateDraft(
    accessToken: string,
    authorizedSiteId: string,
    input: JsonObject,
  ) {
    const change = this.normalizedUpdate(authorizedSiteId, input);
    const current = await this.readPrecondition(
      accessToken,
      change.siteId,
      change.postId,
      change.expectedModified,
    );
    if (current.status !== "draft")
      throw new WordPressComApiError(
        "provider_validation_error",
        "Only a WordPress.com draft can be updated by this action.",
        409,
      );
    const value = await this.request(
      accessToken,
      "POST",
      `/rest/v1.1/sites/${this.segment(change.siteId)}/posts/${this.segment(change.postId)}`,
      {},
      this.postBody(change, "draft"),
    );
    return {
      operation: "update_draft",
      post: this.post(value),
      previousModified: current.modified,
      digest: this.digest(change),
      idempotencyKey: this.requiredText(
        input.idempotencyKey,
        180,
        "idempotencyKey",
      ),
      providerRequestCount: 2,
    };
  }

  async publishPost(
    accessToken: string,
    authorizedSiteId: string,
    input: JsonObject,
  ) {
    const change = this.normalizedPublish(authorizedSiteId, input);
    const current = await this.readPrecondition(
      accessToken,
      change.siteId,
      change.postId,
      change.expectedModified,
    );
    if (current.status !== "draft" && current.status !== "pending")
      throw new WordPressComApiError(
        "provider_validation_error",
        "Only a WordPress.com draft or pending post can be published by this action.",
        409,
      );
    const value = await this.request(
      accessToken,
      "POST",
      `/rest/v1.1/sites/${this.segment(change.siteId)}/posts/${this.segment(change.postId)}`,
      {},
      new URLSearchParams({ status: "publish", publicize: "false" }),
    );
    const post = this.post(value);
    if (post.status !== "publish")
      throw new WordPressComApiError(
        "provider_validation_error",
        "WordPress.com did not publish the post.",
      );
    return {
      operation: "publish",
      post,
      previousModified: current.modified,
      digest: this.digest(change),
      idempotencyKey: this.requiredText(
        input.idempotencyKey,
        180,
        "idempotencyKey",
      ),
      providerRequestCount: 2,
    };
  }

  private async readPrecondition(
    accessToken: string,
    siteId: string,
    postId: string,
    expectedModified: string,
  ) {
    const value = await this.request(
      accessToken,
      "GET",
      `/rest/v1.1/sites/${this.segment(siteId)}/posts/${this.segment(postId)}`,
      { context: "edit" },
    );
    const current = this.post(value);
    if (!this.sameInstant(current.modified, expectedModified))
      throw new WordPressComApiError(
        "provider_validation_error",
        "The WordPress.com post changed after it was reviewed; reload it before retrying.",
        409,
      );
    return current;
  }

  private async request(
    accessToken: string,
    method: "GET" | "POST",
    path: string,
    query: Record<string, string> = {},
    body?: URLSearchParams,
  ) {
    if (
      !path.startsWith("/rest/v1.1/") ||
      path.includes("..") ||
      path.includes("//")
    )
      throw new WordPressComApiError(
        "provider_validation_error",
        "WordPress.com API path is invalid.",
      );
    const url = new URL(`${this.origin}${path}`);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    return this.requestUrl(accessToken, method, url, body, true);
  }

  private async requestUrl(
    accessToken: string,
    method: "GET" | "POST",
    url: URL,
    body?: URLSearchParams,
    bearer = true,
  ): Promise<JsonObject> {
    if (!accessToken || accessToken.length > 10000)
      throw new WordPressComApiError(
        "credential_missing",
        "A WordPress.com OAuth access token is required.",
        401,
      );
    if (url.origin !== this.origin)
      throw new WordPressComApiError(
        "provider_validation_error",
        "WordPress.com API origin is invalid.",
      );
    const encoded = body?.toString();
    if (encoded && Buffer.byteLength(encoded) > 100000)
      throw new WordPressComApiError(
        "provider_validation_error",
        "WordPress.com request exceeds 100 KB.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(bearer ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(encoded
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        body: encoded,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new WordPressComApiError(
        "provider_unavailable",
        "WordPress.com could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (raw.length > 4000000)
      throw new WordPressComApiError(
        "provider_validation_error",
        "WordPress.com response exceeded Relay bounds.",
      );
    let value: JsonObject = {};
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      value = {};
    }
    if (!response.ok || value.error) {
      throw new WordPressComApiError(
        this.code(response.status),
        response.status === 429
          ? `WordPress.com rate limit reached; retry after ${response.headers.get("retry-after") ?? "the provider window"}.`
          : response.status === 401
            ? "WordPress.com authorization is invalid; reconnect the site."
            : response.status === 403
              ? "WordPress.com denied the requested site capability or scope."
              : response.status === 409
                ? "WordPress.com reported a post conflict; reload it before retrying."
                : "WordPress.com rejected the request.",
        response.status,
      );
    }
    return value;
  }

  private normalizedChange(
    authorizedSiteId: string,
    input: JsonObject,
  ): JsonObject {
    const operation = this.text(input.operation);
    if (operation === "create_draft")
      return this.normalizedCreate(authorizedSiteId, input);
    if (operation === "update_draft")
      return this.normalizedUpdate(authorizedSiteId, input);
    if (operation === "publish")
      return this.normalizedPublish(authorizedSiteId, input);
    throw new WordPressComApiError(
      "provider_validation_error",
      "WordPress.com operation must be create_draft, update_draft, or publish.",
    );
  }
  private normalizedCreate(authorizedSiteId: string, input: JsonObject) {
    const fields = this.fields(input, true);
    return {
      operation: "create_draft",
      siteId: this.boundSite(input.siteId, authorizedSiteId),
      ...fields,
    };
  }
  private normalizedUpdate(authorizedSiteId: string, input: JsonObject) {
    const fields = this.fields(input, false);
    if (!Object.keys(fields).length)
      throw new WordPressComApiError(
        "provider_validation_error",
        "A WordPress.com draft update needs at least one changed field.",
      );
    return {
      operation: "update_draft",
      siteId: this.boundSite(input.siteId, authorizedSiteId),
      postId: this.id(input.postId, "postId"),
      expectedModified: this.iso(input.expectedModified, "expectedModified"),
      ...fields,
    };
  }
  private normalizedPublish(authorizedSiteId: string, input: JsonObject) {
    return {
      operation: "publish",
      siteId: this.boundSite(input.siteId, authorizedSiteId),
      postId: this.id(input.postId, "postId"),
      expectedModified: this.iso(input.expectedModified, "expectedModified"),
    };
  }
  private fields(input: JsonObject, required: boolean): JsonObject {
    const result: JsonObject = {};
    const title = this.optionalText(input.title, 300, "title");
    const content = this.optionalText(input.content, 50000, "content");
    const excerpt =
      input.excerpt === ""
        ? ""
        : this.optionalText(input.excerpt, 2000, "excerpt");
    const slug = this.optionalSlug(input.slug);
    const categories = this.stringList(input.categories, "categories", 20);
    const tags = this.stringList(input.tags, "tags", 30);
    if (title !== null) result.title = title;
    if (content !== null) result.content = content;
    if (excerpt !== null) result.excerpt = excerpt;
    if (slug !== null) result.slug = slug;
    if (categories !== null) result.categories = categories;
    if (tags !== null) result.tags = tags;
    if (required && (!title || !content))
      throw new WordPressComApiError(
        "provider_validation_error",
        "A WordPress.com draft requires a title and content.",
      );
    return result;
  }
  private postBody(change: JsonObject, status: "draft") {
    const body = new URLSearchParams({ status, publicize: "false" });
    for (const key of ["title", "content", "excerpt", "slug"] as const)
      if (typeof change[key] === "string") body.set(key, change[key] as string);
    for (const key of ["categories", "tags"] as const)
      if (Array.isArray(change[key]))
        body.set(key, (change[key] as string[]).join(","));
    return body;
  }

  private site(value: unknown) {
    const site = this.object(value);
    return {
      id: this.id(site.ID ?? site.id, "siteId"),
      name: this.bounded(this.text(site.name), 1000),
      description: this.bounded(this.text(site.description), 2000),
      url: this.bounded(this.text(site.URL ?? site.url), 2000),
      domain: this.text(site.domain),
      jetpack: site.jetpack === true,
      isPrivate: site.is_private === true,
      visible: site.visible !== false,
      capabilities: this.booleanMap(site.capabilities, 40),
      icon: null,
    };
  }
  private post(value: unknown) {
    const post = this.object(value);
    const author = this.object(post.author);
    return {
      id: this.id(post.ID ?? post.id, "postId"),
      siteId: this.optionalId(post.site_ID),
      status: this.text(post.status),
      type: this.text(post.type),
      title: this.bounded(this.text(post.title), 300),
      content: this.bounded(this.text(post.content), 50000),
      excerpt: this.bounded(this.text(post.excerpt), 2000),
      slug: this.bounded(this.text(post.slug), 200),
      url: this.bounded(this.text(post.URL ?? post.url), 2000),
      date: this.text(post.date),
      modified: this.text(post.modified),
      author: {
        id: this.optionalId(author.ID ?? author.id),
        name: this.bounded(this.text(author.name), 500),
        login: this.text(author.login),
      },
      categories: this.taxonomy(post.categories, 20),
      tags: this.taxonomy(post.tags, 30),
      capabilities: this.booleanMap(post.capabilities, 30),
      mediaIncluded: false,
    };
  }
  private taxonomy(value: unknown, max: number) {
    return this.array(value)
      .slice(0, max)
      .map((entry) => {
        const item = this.object(entry);
        return {
          id: this.optionalId(item.ID ?? item.id),
          name: this.bounded(this.text(item.name), 200),
          slug: this.bounded(this.text(item.slug), 200),
        };
      });
  }
  private booleanMap(value: unknown, max: number) {
    return Object.fromEntries(
      Object.entries(this.object(value))
        .filter(([, item]) => typeof item === "boolean")
        .slice(0, max),
    );
  }
  private stringList(
    value: unknown,
    field: string,
    max: number,
  ): string[] | null {
    if (value === undefined) return null;
    if (!Array.isArray(value) || value.length > max)
      throw new WordPressComApiError(
        "provider_validation_error",
        `WordPress.com ${field} is invalid.`,
      );
    const items = value
      .map((item) => this.optionalText(item, 100, field))
      .filter((item): item is string => !!item);
    if (
      items.length !== value.length ||
      new Set(items.map((item) => item.toLowerCase())).size !== items.length
    )
      throw new WordPressComApiError(
        "provider_validation_error",
        `WordPress.com ${field} contains invalid or duplicate values.`,
      );
    return items;
  }
  private boundSite(value: unknown, authorizedSiteId: string) {
    const siteId = this.id(value, "siteId");
    if (siteId !== authorizedSiteId)
      throw new WordPressComApiError(
        "insufficient_scope",
        "The requested WordPress.com site does not match this specific-blog grant.",
        403,
      );
    return siteId;
  }
  private id(value: unknown, field: string) {
    const id =
      typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : this.text(value);
    if (!id || !/^[1-9][0-9]{0,19}$/.test(id))
      throw new WordPressComApiError(
        "provider_validation_error",
        `WordPress.com ${field} is invalid.`,
      );
    return id;
  }
  private optionalId(value: unknown) {
    try {
      return value === undefined || value === null
        ? null
        : this.id(value, "id");
    } catch {
      return null;
    }
  }
  private optionalText(value: unknown, max: number, field: string) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string" || value.length > max || !value.trim())
      throw new WordPressComApiError(
        "provider_validation_error",
        `WordPress.com ${field} is invalid.`,
      );
    return value.trim();
  }
  private requiredText(value: unknown, max: number, field: string) {
    const text = this.optionalText(value, max, field);
    if (!text)
      throw new WordPressComApiError(
        "provider_validation_error",
        `WordPress.com ${field} is invalid.`,
      );
    return text;
  }
  private optionalSlug(value: unknown) {
    if (value === undefined || value === null) return null;
    const slug = this.optionalText(value, 200, "slug")!;
    if (!/^[A-Za-z0-9_-]+$/.test(slug))
      throw new WordPressComApiError(
        "provider_validation_error",
        "WordPress.com slug is invalid.",
      );
    return slug;
  }
  private iso(value: unknown, field: string) {
    const text = this.optionalText(value, 40, field);
    if (!text || Number.isNaN(Date.parse(text)))
      throw new WordPressComApiError(
        "provider_validation_error",
        `WordPress.com ${field} is invalid.`,
      );
    return text;
  }
  private sameInstant(left: string | null, right: string) {
    return (
      !!left &&
      !Number.isNaN(Date.parse(left)) &&
      Date.parse(left) === Date.parse(right)
    );
  }
  private enumValue(value: unknown, allowed: string[], field: string) {
    if (value === undefined) return null;
    const item = this.optionalText(value, 40, field);
    if (!item || !allowed.includes(item))
      throw new WordPressComApiError(
        "provider_validation_error",
        `WordPress.com ${field} is invalid.`,
      );
    return item;
  }
  private limit(value: unknown, fallback: number, max: number) {
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > max)
      throw new WordPressComApiError(
        "provider_validation_error",
        "WordPress.com maxResults is invalid.",
      );
    return number;
  }
  private offset(value: unknown) {
    if (value === undefined) return 0;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 100000)
      throw new WordPressComApiError(
        "provider_validation_error",
        "WordPress.com offset is invalid.",
      );
    return number;
  }
  private scopeList(value: unknown) {
    return (this.text(value) ?? "")
      .split(/[ ,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 50);
  }
  private digest(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
  private segment(value: string) {
    return encodeURIComponent(value);
  }
  private bounded(value: string | null, max: number) {
    return value ? value.slice(0, max) : null;
  }
  private numeric(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
