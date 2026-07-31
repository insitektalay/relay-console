import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class NextdoorApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class NextdoorApiAdapter {
  private readonly baseUrl = "https://nextdoor.com/external/api/partner/v1";
  private readonly maxResponseBytes = 512 * 1024;

  async getProfiles(accessToken: string) {
    return this.request(accessToken, "/me/profiles", { method: "GET" });
  }

  async listOwnPosts(accessToken: string, secureProfileId: string, limit = 10) {
    const boundedLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
    const query = new URLSearchParams({ secure_profile_id: secureProfileId });
    const body = await this.request(accessToken, `/post/?${query}`, {
      method: "GET",
    });
    const object = this.object(body);
    const values = Array.isArray(body)
      ? body
      : Array.isArray(object.posts)
        ? object.posts
        : Array.isArray(object.results)
          ? object.results
          : [];
    return values
      .map((value) => this.shapePost(value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .slice(0, boundedLimit);
  }

  async createTextPost(
    accessToken: string,
    secureProfileId: string,
    text: string,
  ) {
    const prepared = this.prepareTextPost(text);
    const bodyText = prepared.text;
    const result = await this.request(accessToken, "/post/create/", {
      method: "POST",
      body: { secure_profile_id: secureProfileId, body_text: bodyText },
    });
    const post = this.shapePost(result);
    if (!post) {
      throw new NextdoorApiError(
        "provider_validation_error",
        "Nextdoor returned an invalid post response",
      );
    }
    return post;
  }

  prepareTextPost(text: string) {
    const bodyText = text.normalize("NFC").trim();
    if (!bodyText)
      throw new NextdoorApiError(
        "provider_validation_error",
        "text is required",
      );
    const byteCount = Buffer.byteLength(bodyText, "utf8");
    if (byteCount > 8192) {
      throw new NextdoorApiError(
        "provider_validation_error",
        "text must be 8192 bytes or fewer",
      );
    }
    return { text: bodyText, byteCount, providerSideEffect: false as const };
  }

  private async request(
    accessToken: string,
    path: string,
    input: { method: "GET" | "POST"; body?: JsonObject },
  ) {
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.baseUrl}${path}`, {
        method: input.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole/1.0 NextdoorConnector",
          ...(input.body ? { "Content-Type": "application/json" } : {}),
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new NextdoorApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Nextdoor request timed out"
          : "Nextdoor request failed",
      );
    }
    const body = await this.safeBody(response, response.ok);
    if (!response.ok) {
      throw new NextdoorApiError(
        this.errorCode(response.status),
        `Nextdoor request failed with ${response.status}`,
        response.status,
      );
    }
    return body;
  }

  private shapePost(value: unknown) {
    const post = this.object(value);
    const text = this.string(post.body_text) ?? this.string(post.body) ?? "";
    const postId =
      this.identifier(post.guid) ??
      this.identifier(post.post_share_id) ??
      this.identifier(post.share_id) ??
      this.identifier(post.id);
    const shareUrl =
      this.nextdoorShareUrl(post.share_link) ??
      this.nextdoorShareUrl(post.share_url) ??
      this.nextdoorShareUrl(post.url);
    if (!postId && !shareUrl) return null;
    return {
      postId,
      bodyExcerpt: text.slice(0, 2000),
      shareUrl,
      createdAt: this.string(post.created_at) ?? this.string(post.createdAt),
      updatedAt: this.string(post.updated_at) ?? this.string(post.updatedAt),
    };
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private identifier(value: unknown) {
    const text = this.string(value);
    return text && /^[A-Za-z0-9_-]{1,200}$/.test(text) ? text : null;
  }

  private nextdoorShareUrl(value: unknown) {
    const text = this.string(value);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" &&
        url.hostname === "nextdoor.com" &&
        /^\/p\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) &&
        !url.username &&
        !url.password &&
        !url.port &&
        !url.search &&
        !url.hash
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  private async safeBody(response: Response, requireJson: boolean) {
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (
      Number.isFinite(contentLength) &&
      contentLength > this.maxResponseBytes
    ) {
      throw new NextdoorApiError(
        "provider_validation_error",
        "Nextdoor response exceeded the allowed size",
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > this.maxResponseBytes) {
      throw new NextdoorApiError(
        "provider_validation_error",
        "Nextdoor response exceeded the allowed size",
      );
    }
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (!requireJson) return {};
      throw new NextdoorApiError(
        "provider_validation_error",
        "Nextdoor returned an invalid JSON response",
      );
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
