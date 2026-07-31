import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class TumblrApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class TumblrApiAdapter {
  private readonly baseUrl = "https://api.tumblr.com";

  async getAccount(token: string, selectedBlogUuid: string) {
    const root = this.object(await this.request(token, "/v2/user/info"));
    const user = this.object(this.object(root.response).user);
    const accountName = this.required(user.name, "account name", 128);
    const blogs = (Array.isArray(user.blogs) ? user.blogs : [])
      .slice(0, 50)
      .map((item) => this.blog(item));
    if (!blogs.some((blog) => blog.blogUuid === selectedBlogUuid))
      throw new TumblrApiError(
        "provider_validation_error",
        "Tumblr selected blog is no longer owned by the connected account",
      );
    return { accountName, blogs, selectedBlogUuid };
  }

  async getOwnedBlog(token: string, blogUuidInput: unknown) {
    const blogUuid = this.blogUuid(blogUuidInput);
    const root = this.object(
      await this.request(
        token,
        `/v2/blog/${encodeURIComponent(blogUuid)}/info`,
      ),
    );
    const blog = this.blog(this.object(root.response).blog);
    if (blog.blogUuid !== blogUuid)
      throw new TumblrApiError(
        "provider_validation_error",
        "Tumblr returned a different blog than the selected binding",
      );
    return blog;
  }

  async listPublishedPosts(
    token: string,
    blogUuidInput: unknown,
    blogName: string,
    limitInput: unknown,
    tagInput: unknown,
  ) {
    const blogUuid = this.blogUuid(blogUuidInput);
    const limit = this.limit(limitInput);
    const tag = this.optionalText(tagInput, 100);
    const root = this.object(
      await this.request(
        token,
        `/v2/blog/${encodeURIComponent(blogUuid)}/posts`,
        { npf: "true", limit: String(limit), ...(tag ? { tag } : {}) },
      ),
    );
    const response = this.object(root.response);
    const returnedBlog = this.blog(response.blog);
    if (returnedBlog.blogUuid !== blogUuid && returnedBlog.name !== blogName)
      throw new TumblrApiError(
        "provider_validation_error",
        "Tumblr returned posts for a different blog",
      );
    const posts = (Array.isArray(response.posts) ? response.posts : [])
      .slice(0, limit)
      .map((item) => this.post(item));
    if (posts.some((post) => post.blogName && post.blogName !== blogName))
      throw new TumblrApiError(
        "provider_validation_error",
        "Tumblr returned a post outside the selected blog",
      );
    return posts;
  }

  private async request(
    token: string,
    path: string,
    query: Record<string, string> = {},
  ) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "ClawChat-Tumblr/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new TumblrApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Tumblr request timed out"
          : "Tumblr request failed",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new TumblrApiError(
        "provider_validation_error",
        "Tumblr response exceeded Relay bounds",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new TumblrApiError(
        "provider_validation_error",
        "Tumblr returned invalid JSON",
      );
    }
    if (!response.ok)
      throw new TumblrApiError(
        this.errorCode(response.status),
        `Tumblr request failed with ${response.status}`,
        response.status,
      );
    return body;
  }

  private blog(value: unknown) {
    const item = this.object(value);
    const blogUuid = this.blogUuid(item.uuid);
    return {
      blogUuid,
      name: this.required(item.name, "blog name", 128),
      title: this.optionalText(item.title, 300),
      url: this.httpsUrl(item.url),
      description: this.cleanText(item.description, 1_500),
      updatedTimestamp: typeof item.updated === "number" ? item.updated : null,
      postCount: typeof item.posts === "number" ? item.posts : null,
      primary: item.primary === true,
      type: this.optionalText(item.type, 50),
    };
  }

  private post(value: unknown) {
    const item = this.object(value);
    const content = Array.isArray(item.content) ? item.content : [];
    const trail = Array.isArray(item.trail) ? item.trail : [];
    const npfText = [...content, ...trail]
      .flatMap((block) => {
        const object = this.object(block);
        const nested = Array.isArray(object.content) ? object.content : [];
        return [object, ...nested.map((value) => this.object(value))];
      })
      .filter((block) => block.type === "text")
      .map((block) => this.optionalText(block.text, 2_000))
      .filter((value): value is string => Boolean(value));
    const legacy = [
      item.title,
      item.body,
      item.caption,
      item.description,
      item.answer,
      item.question,
    ]
      .map((part) => this.cleanText(part, 2_000))
      .filter((value): value is string => Boolean(value));
    const joined = (npfText.length ? npfText : legacy).join("\n\n");
    const text = joined.slice(0, 4_000);
    return {
      postId: this.required(item.id_string ?? item.id, "post ID", 128),
      postUrl: this.httpsUrl(item.post_url),
      blogName: this.optionalText(item.blog_name, 128),
      date: this.optionalText(item.date, 100),
      timestamp: typeof item.timestamp === "number" ? item.timestamp : null,
      state: this.optionalText(item.state, 50),
      tags: (Array.isArray(item.tags) ? item.tags : [])
        .slice(0, 20)
        .map((tag) => this.optionalText(tag, 100))
        .filter((tag): tag is string => Boolean(tag)),
      text,
      contentFormat: npfText.length ? "npf" : "legacy",
      textTruncated: joined.length > 4_000,
    };
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private optionalText(value: unknown, max: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, max)
      : null;
  }
  private required(value: unknown, field: string, max: number) {
    const text =
      typeof value === "number" ? String(value) : this.optionalText(value, max);
    if (!text || text.length > max)
      throw new TumblrApiError(
        "provider_validation_error",
        `Tumblr ${field} is invalid`,
      );
    return text;
  }
  private blogUuid(value: unknown) {
    const uuid = this.optionalText(value, 130);
    if (!uuid || !/^t:[A-Za-z0-9_-]{1,128}$/.test(uuid))
      throw new TumblrApiError(
        "provider_validation_error",
        "Tumblr blog UUID is invalid",
      );
    return uuid;
  }
  private limit(value: unknown) {
    const number = typeof value === "number" ? value : Number(value ?? 10);
    return Number.isFinite(number)
      ? Math.max(1, Math.min(10, Math.trunc(number)))
      : 10;
  }
  private cleanText(value: unknown, max: number) {
    const text = this.optionalText(value, max * 3);
    if (!text) return null;
    return text
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }
  private httpsUrl(value: unknown) {
    const text = this.optionalText(value, 2_048);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
