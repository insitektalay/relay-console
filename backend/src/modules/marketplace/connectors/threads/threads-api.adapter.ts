import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class ThreadsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ThreadsApiAdapter {
  private readonly baseUrl = "https://graph.threads.net";
  private readonly postFields =
    "id,text,media_type,timestamp,permalink,shortcode,is_quote_post,has_replies,owner";

  async getProfile(accessToken: string) {
    const value = await this.request(accessToken, "GET", "/me", {
      fields:
        "id,username,name,is_verified,threads_profile_picture_url,threads_biography",
    });
    return this.profile(value);
  }

  async listOwnPosts(
    accessToken: string,
    boundProfileId: string,
    limitInput: unknown,
  ) {
    const limit = this.limit(limitInput);
    const value = this.object(
      await this.request(accessToken, "GET", "/me/threads", {
        fields: this.postFields,
        limit: String(limit),
      }),
    );
    const posts = (Array.isArray(value.data) ? value.data : [])
      .slice(0, limit)
      .map((item) => this.post(item));
    if (posts.some((post) => post.ownerId && post.ownerId !== boundProfileId))
      throw new ThreadsApiError(
        "provider_validation_error",
        "Threads returned a post outside the connected profile",
      );
    return posts;
  }

  async getOwnPost(
    accessToken: string,
    boundProfileId: string,
    postIdInput: unknown,
  ) {
    const postId = this.id(postIdInput, "postId");
    const post = this.post(
      await this.request(accessToken, "GET", `/${encodeURIComponent(postId)}`, {
        fields: this.postFields,
      }),
    );
    if (post.ownerId !== boundProfileId)
      throw new ThreadsApiError(
        "provider_validation_error",
        "Threads post is not owned by the connected profile",
      );
    return post;
  }

  draftText(textInput: unknown) {
    const text = this.text(textInput);
    return { text, characterCount: [...text].length, providerCallMade: false };
  }

  async publishText(accessToken: string, textInput: unknown) {
    const text = this.text(textInput);
    const container = this.object(
      await this.request(accessToken, "POST", "/me/threads", {
        media_type: "TEXT",
        text,
      }),
    );
    const creationId = this.id(container.id, "creationId");
    const published = this.object(
      await this.request(accessToken, "POST", "/me/threads_publish", {
        creation_id: creationId,
      }),
    );
    const postId = this.id(published.id, "postId");
    return {
      postId,
      text,
      characterCount: [...text].length,
      providerAcknowledged: true,
      ambiguous: false,
    };
  }

  private async request(
    accessToken: string,
    method: "GET" | "POST",
    path: string,
    query: Record<string, string>,
  ) {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new ThreadsApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Threads request timed out"
          : "Threads request failed",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new ThreadsApiError(
        "provider_validation_error",
        "Threads response exceeded Relay bounds",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ThreadsApiError(
        "provider_validation_error",
        "Threads returned invalid JSON",
      );
    }
    if (!response.ok)
      throw new ThreadsApiError(
        this.errorCode(response.status),
        `Threads request failed with ${response.status}`,
        response.status,
      );
    return body;
  }

  private profile(value: unknown) {
    const item = this.object(value),
      profileId = this.id(item.id, "profileId"),
      biography = this.string(item.threads_biography) ?? "";
    return {
      profileId,
      username: this.string(item.username),
      name: this.string(item.name),
      isVerified: item.is_verified === true,
      biography: biography.slice(0, 500),
      biographyTruncated: biography.length > 500,
      profilePictureAvailable: Boolean(
        this.httpsUrl(item.threads_profile_picture_url),
      ),
    };
  }
  private post(value: unknown) {
    const item = this.object(value),
      owner = this.object(item.owner),
      text = this.string(item.text) ?? "";
    return {
      postId: this.id(item.id, "postId"),
      text: text.slice(0, 2000),
      textTruncated: text.length > 2000,
      mediaType: this.string(item.media_type),
      timestamp: this.string(item.timestamp),
      permalink: this.httpsUrl(item.permalink),
      shortcode: this.string(item.shortcode),
      isQuotePost: item.is_quote_post === true,
      hasReplies: item.has_replies === true,
      ownerId: this.optionalId(owner.id),
    };
  }
  private text(value: unknown) {
    const text = this.string(value);
    if (!text || [...text].length > 500)
      throw new ThreadsApiError(
        "provider_validation_error",
        "Threads text must contain 1 to 500 characters",
      );
    if (
      /(?:(?:https?:\/\/)|(?:www\.)|(?:\b[a-z0-9-]+\.(?:com|org|net|io|co|app|dev)\b))/i.test(
        text,
      )
    )
      throw new ThreadsApiError(
        "policy_blocked",
        "Threads V1 does not publish links",
      );
    return text;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  private optionalId(value: unknown) {
    const text = this.string(value);
    return text && /^[A-Za-z0-9_-]{1,128}$/.test(text) ? text : null;
  }
  private id(value: unknown, field: string) {
    const id = this.optionalId(value);
    if (!id)
      throw new ThreadsApiError(
        "provider_validation_error",
        `Threads ${field} is invalid`,
      );
    return id;
  }
  private limit(value: unknown) {
    const number = typeof value === "number" ? value : Number(value ?? 10);
    return Number.isFinite(number)
      ? Math.max(1, Math.min(10, Math.trunc(number)))
      : 10;
  }
  private httpsUrl(value: unknown) {
    const text = this.string(value);
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
