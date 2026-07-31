import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GoogleChatApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleChatApiAdapter {
  private readonly origin = "https://chat.googleapis.com/v1";

  health(token: string) {
    this.token(token);
    return {
      userAuthOnly: true,
      explicitSpacesOnly: true,
      providerRequestCount: 0,
    };
  }

  async getSpace(token: string, input: JsonObject) {
    const name = this.spaceName(input.spaceName);
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/${name}`,
      {},
    );
    return { space: this.space(value), providerRequestCount: 1 };
  }

  async listMessages(token: string, input: JsonObject) {
    const name = this.spaceName(input.spaceName);
    const pageSize = this.pageSize(input.pageSize);
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/${name}/messages`,
      {
        pageSize: String(pageSize),
        orderBy: "createTime DESC",
        showDeleted: "false",
      },
    );
    const messages = this.array(value.messages)
      .slice(0, 25)
      .map((message) => this.message(message));
    return {
      messages,
      resultCount: messages.length,
      nextPageTokenPresent: Boolean(this.text(value.nextPageToken, 2048)),
      nextPageTokenFollowed: false,
      senderIdentityReturned: false,
      attachmentsMediaReturned: false,
      reactionsReturned: false,
      privateMessagesReturned: false,
      providerRequestCount: 1,
    };
  }

  prepareMessage(input: JsonObject) {
    const spaceName = this.spaceName(input.spaceName);
    const text = this.messageText(input.text);
    const threadName = this.threadName(input.threadName, spaceName);
    const preview = {
      spaceName,
      text,
      characterCount: text.length,
      threadName,
      replyFallbackAllowed: false,
      providerMutation: false,
    };
    return {
      preview,
      digest: createHash("sha256")
        .update(JSON.stringify(preview))
        .digest("hex"),
      providerRequestCount: 0,
    };
  }

  async createMessage(token: string, input: JsonObject) {
    const spaceName = this.spaceName(input.spaceName);
    const requestId = this.requestId(input.requestId);
    const text = this.messageText(input.text);
    const threadName = this.threadName(input.threadName, spaceName);
    const query: Record<string, string> = { requestId };
    if (threadName) query.messageReplyOption = "REPLY_MESSAGE_OR_FAIL";
    const value = await this.request(
      token,
      "POST",
      `${this.origin}/${spaceName}/messages`,
      query,
      { text, ...(threadName ? { thread: { name: threadName } } : {}) },
    );
    return {
      operation: "create_message",
      message: this.message(value),
      requestId,
      replyFallbackAllowed: false,
      providerRequestCount: 1,
    };
  }

  private async request(
    token: string,
    method: string,
    base: string,
    query: Record<string, string>,
    body?: JsonObject,
  ) {
    this.token(token);
    const url = new URL(base);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "chat.googleapis.com" ||
      !url.pathname.startsWith("/v1/spaces/")
    )
      throw new GoogleChatApiError(
        "provider_validation_error",
        "Google Chat API URL is unsafe.",
      );
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new GoogleChatApiError(
        "provider_unavailable",
        "Google Chat API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1048576)
      throw new GoogleChatApiError(
        "provider_validation_error",
        "Google Chat response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GoogleChatApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Google Chat API rejected the bounded request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleChatApiError(
        "provider_validation_error",
        "Google Chat API returned invalid JSON.",
      );
    }
  }

  private space(value: unknown) {
    const record = this.object(value);
    return {
      name: this.text(record.name, 256),
      displayName: this.text(record.displayName, 256),
      spaceType: this.text(record.spaceType, 32),
      spaceThreadingState: this.text(record.spaceThreadingState, 64),
      externalUserAllowed:
        typeof record.externalUserAllowed === "boolean"
          ? record.externalUserAllowed
          : null,
      membershipsReturned: false,
    };
  }

  private message(value: unknown) {
    const record = this.object(value);
    const sender = this.object(record.sender);
    const thread = this.object(record.thread);
    return {
      name: this.text(record.name, 384),
      text: this.text(record.text, 4000),
      createTime: this.text(record.createTime, 64),
      updateTime: this.text(record.lastUpdateTime ?? record.updateTime, 64),
      threadName: this.text(thread.name, 384),
      authorType: this.text(sender.type, 32),
      senderIdentityReturned: false,
      formattedTextReturned: false,
      annotationsReturned: false,
      attachmentsReturned: false,
      reactionsReturned: false,
      privateMessageViewerReturned: false,
      quotedMessageReturned: false,
    };
  }

  private token(value: string) {
    if (!value || value.length > 8000)
      throw new GoogleChatApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }

  private spaceName(value: unknown) {
    const name = this.text(value, 256);
    if (!name || !/^spaces\/[A-Za-z0-9_-]+$/.test(name))
      throw new GoogleChatApiError(
        "provider_validation_error",
        "spaceName is invalid.",
      );
    return name;
  }

  private threadName(value: unknown, spaceName: string) {
    if (value == null) return null;
    const name = this.text(value, 384);
    const prefix = `${spaceName}/threads/`;
    if (
      !name ||
      !name.startsWith(prefix) ||
      !/^[A-Za-z0-9_-]+$/.test(name.slice(prefix.length))
    )
      throw new GoogleChatApiError(
        "provider_validation_error",
        "threadName must be an explicit thread in the requested Space.",
      );
    return name;
  }

  private messageText(value: unknown) {
    if (typeof value !== "string")
      throw new GoogleChatApiError(
        "provider_validation_error",
        "Message text is required.",
      );
    const text = value.trim();
    const lower = text.toLowerCase();
    if (
      !text ||
      text.length > 4000 ||
      lower.includes("@all") ||
      lower.includes("<users/")
    )
      throw new GoogleChatApiError(
        "provider_validation_error",
        "Plain text must be bounded and contain no mass or user-markup mentions.",
      );
    return text;
  }

  private pageSize(value: unknown) {
    if (value == null) return 25;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 25
    )
      throw new GoogleChatApiError(
        "provider_validation_error",
        "pageSize must be an integer from 1 through 25.",
      );
    return value;
  }

  private requestId(value: unknown) {
    const requestId = this.text(value, 128);
    if (!requestId || !/^[A-Za-z0-9_-]+$/.test(requestId))
      throw new GoogleChatApiError(
        "provider_validation_error",
        "requestId is invalid.",
      );
    return requestId;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" && value.length <= max ? value : null;
  }
}
