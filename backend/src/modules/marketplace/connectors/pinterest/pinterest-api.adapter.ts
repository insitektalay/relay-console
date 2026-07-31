import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
export class PinterestApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PinterestApiAdapter {
  private readonly baseUrl = "https://api.pinterest.com/v5";
  async getUserAccount(token: string) {
    return this.user(await this.request(token, "/user_account"));
  }
  async listBoards(token: string, username: string, limitInput: unknown) {
    const limit = this.limit(limitInput),
      body = this.object(
        await this.request(token, "/boards", { page_size: String(limit) }),
      ),
      boards = (Array.isArray(body.items) ? body.items : [])
        .slice(0, limit)
        .map((item) => this.board(item));
    if (
      boards.some(
        (item) => item.ownerUsername && item.ownerUsername !== username,
      )
    )
      throw new PinterestApiError(
        "provider_validation_error",
        "Pinterest returned a board outside the connected account",
      );
    return boards;
  }
  async listPins(token: string, username: string, limitInput: unknown) {
    const limit = this.limit(limitInput),
      body = this.object(
        await this.request(token, "/pins", { page_size: String(limit) }),
      ),
      pins = (Array.isArray(body.items) ? body.items : [])
        .slice(0, limit)
        .map((item) => this.pin(item));
    if (
      pins.some(
        (item) =>
          item.boardOwnerUsername && item.boardOwnerUsername !== username,
      )
    )
      throw new PinterestApiError(
        "provider_validation_error",
        "Pinterest returned a Pin outside the connected account",
      );
    return pins;
  }
  async getPin(token: string, username: string, pinIdInput: unknown) {
    const pinId = this.id(pinIdInput, "pinId"),
      pin = this.pin(
        await this.request(token, `/pins/${encodeURIComponent(pinId)}`),
      );
    if (pin.boardOwnerUsername !== username)
      throw new PinterestApiError(
        "provider_validation_error",
        "Pinterest Pin is outside the connected account",
      );
    return pin;
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
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new PinterestApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Pinterest request timed out"
          : "Pinterest request failed",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new PinterestApiError(
        "provider_validation_error",
        "Pinterest response exceeded Relay bounds",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new PinterestApiError(
        "provider_validation_error",
        "Pinterest returned invalid JSON",
      );
    }
    if (!response.ok)
      throw new PinterestApiError(
        this.errorCode(response.status),
        `Pinterest request failed with ${response.status}`,
        response.status,
      );
    return body;
  }
  private user(value: unknown) {
    const item = this.object(value);
    return {
      userAccountId: this.id(item.id, "userAccountId"),
      username: this.required(item.username, "username", 128),
      accountType: this.string(item.account_type),
      profileImageUrl: this.httpsUrl(item.profile_image),
      websiteUrl: this.httpsUrl(item.website_url),
    };
  }
  private board(value: unknown) {
    const item = this.object(value),
      owner = this.object(item.owner),
      description = this.string(item.description) ?? "";
    return {
      boardId: this.id(item.id, "boardId"),
      name: this.required(item.name, "name", 300),
      description: description.slice(0, 1000),
      descriptionTruncated: description.length > 1000,
      privacy: this.string(item.privacy),
      ownerUsername: this.string(owner.username),
      pinCount: typeof item.pin_count === "number" ? item.pin_count : null,
    };
  }
  private pin(value: unknown) {
    const item = this.object(value),
      owner = this.object(item.board_owner),
      media = this.object(item.media),
      images = this.object(media.images),
      image = this.object(images["600x"]),
      description = this.string(item.description) ?? "";
    return {
      pinId: this.id(item.id, "pinId"),
      title: this.string(item.title),
      description: description.slice(0, 1500),
      descriptionTruncated: description.length > 1500,
      altText: this.string(item.alt_text)?.slice(0, 500) ?? null,
      link: this.httpsUrl(item.link),
      createdAt: this.string(item.created_at),
      mediaType: this.string(media.media_type),
      imageUrl: this.httpsUrl(image.url),
      boardId: this.optionalId(item.board_id),
      boardOwnerUsername: this.string(owner.username),
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
  private required(value: unknown, field: string, max: number) {
    const text = this.string(value);
    if (!text || text.length > max)
      throw new PinterestApiError(
        "provider_validation_error",
        `Pinterest ${field} is invalid`,
      );
    return text;
  }
  private optionalId(value: unknown) {
    const text = this.string(value);
    return text && /^[A-Za-z0-9_-]{1,128}$/.test(text) ? text : null;
  }
  private id(value: unknown, field: string) {
    const id = this.optionalId(value);
    if (!id)
      throw new PinterestApiError(
        "provider_validation_error",
        `Pinterest ${field} is invalid`,
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
