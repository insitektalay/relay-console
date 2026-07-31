import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type TelegramPersonalBotsCredentials = {
  botToken: string;
  allowedChatIds: string[];
};

export class TelegramPersonalBotsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class TelegramPersonalBotsApiAdapter {
  async health(credentials: TelegramPersonalBotsCredentials) {
    const result = this.object(await this.call(credentials, "getMe", {}));
    if (result?.is_bot !== true)
      throw new TelegramPersonalBotsApiError(
        "provider_validation_error",
        "Telegram credential did not resolve to a bot account.",
      );
    return {
      id: this.string(result.id),
      username: this.string(result.username),
      firstName: this.string(result.first_name),
      allowedChatCount: credentials.allowedChatIds.length,
    };
  }

  getMe(credentials: TelegramPersonalBotsCredentials) {
    return this.call(credentials, "getMe", {});
  }

  async getWebhookInfo(credentials: TelegramPersonalBotsCredentials) {
    const info = this.object(
      await this.call(credentials, "getWebhookInfo", {}),
    );
    return {
      configured: Boolean(this.string(info?.url)),
      hasCustomCertificate: info?.has_custom_certificate === true,
      pendingUpdateCount: this.number(info?.pending_update_count) ?? 0,
      lastErrorDate: this.number(info?.last_error_date) ?? undefined,
      lastErrorMessage: this.string(info?.last_error_message) ?? undefined,
      maxConnections: this.number(info?.max_connections) ?? undefined,
      allowedUpdates: Array.isArray(info?.allowed_updates)
        ? info.allowed_updates.slice(0, 100)
        : [],
    };
  }

  async getChat(
    credentials: TelegramPersonalBotsCredentials,
    input: JsonObject,
  ) {
    const chatId = this.allowedChatId(credentials, input.chatId);
    const chat = this.object(
      await this.call(credentials, "getChat", { chat_id: chatId }),
    );
    return {
      id: this.string(chat?.id),
      type: this.string(chat?.type),
      title: this.string(chat?.title),
      username: this.string(chat?.username),
      isForum: chat?.is_forum === true,
      isDirectMessages: chat?.is_direct_messages === true,
    };
  }

  async getUpdates(
    credentials: TelegramPersonalBotsCredentials,
    input: JsonObject,
  ) {
    const limit = this.integer(input.limit, 1, 100, 20);
    const offset =
      input.offset === undefined
        ? undefined
        : this.integer(
            input.offset,
            -Number.MAX_SAFE_INTEGER,
            Number.MAX_SAFE_INTEGER,
          );
    const result = await this.call(credentials, "getUpdates", {
      limit,
      timeout: 0,
      ...(offset === undefined ? {} : { offset }),
      allowed_updates: [
        "message",
        "edited_message",
        "channel_post",
        "edited_channel_post",
        "callback_query",
        "my_chat_member",
        "chat_member",
        "chat_join_request",
      ],
    });
    const updates = Array.isArray(result) ? result : [];
    const filtered = updates.filter((entry) => {
      const chatId = this.updateChatId(entry);
      return chatId !== null && credentials.allowedChatIds.includes(chatId);
    });
    const highestUpdateId = updates.reduce<number | null>((highest, entry) => {
      const id = this.number(this.object(entry)?.update_id);
      return id === null ? highest : Math.max(highest ?? id, id);
    }, null);
    return {
      updates: filtered,
      returnedCount: filtered.length,
      excludedCount: updates.length - filtered.length,
      nextOffset: highestUpdateId === null ? undefined : highestUpdateId + 1,
    };
  }

  sendMessage(credentials: TelegramPersonalBotsCredentials, input: JsonObject) {
    const chatId = this.allowedChatId(credentials, input.chatId);
    const text = this.requiredText(input.text, 4096);
    return this.call(credentials, "sendMessage", {
      chat_id: chatId,
      text,
      disable_notification: input.disableNotification === true,
      protect_content: input.protectContent !== false,
    });
  }

  editMessageText(
    credentials: TelegramPersonalBotsCredentials,
    input: JsonObject,
  ) {
    const chatId = this.allowedChatId(credentials, input.chatId);
    const messageId = this.integer(input.messageId, 1, Number.MAX_SAFE_INTEGER);
    const text = this.requiredText(input.text, 4096);
    return this.call(credentials, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
    });
  }

  deleteMessage(
    credentials: TelegramPersonalBotsCredentials,
    input: JsonObject,
  ) {
    const chatId = this.allowedChatId(credentials, input.chatId);
    const messageId = this.integer(input.messageId, 1, Number.MAX_SAFE_INTEGER);
    return this.call(credentials, "deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  private async call(
    credentials: TelegramPersonalBotsCredentials,
    method: string,
    body: JsonObject,
  ): Promise<unknown> {
    this.assertCredentials(credentials);
    this.rejectCredentials(body);
    const response = await safeConnectorFetch(
      `https://api.telegram.org/bot${credentials.botToken}/${method}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0",
        },
        body: JSON.stringify(body),
      },
    );
    const raw = await response.text();
    const bounded = raw.slice(0, 1_000_000);
    let parsed: unknown = null;
    try {
      parsed = bounded ? JSON.parse(bounded) : null;
    } catch {
      throw new TelegramPersonalBotsApiError(
        response.ok ? "provider_unavailable" : this.code(response.status),
        `Telegram Bot API returned a non-JSON response (${response.status}).`,
        response.status,
      );
    }
    const envelope = this.object(parsed);
    if (!response.ok || envelope?.ok !== true) {
      const providerCode = this.number(envelope?.error_code) ?? response.status;
      throw new TelegramPersonalBotsApiError(
        this.code(providerCode),
        this.safeDescription(envelope?.description, credentials.botToken) ??
          `Telegram Bot API rejected ${method}.`,
        providerCode,
      );
    }
    return this.redact(envelope.result);
  }

  private assertCredentials(credentials: TelegramPersonalBotsCredentials) {
    if (!/^\d{5,20}:[A-Za-z0-9_-]{20,}$/.test(credentials.botToken))
      throw new TelegramPersonalBotsApiError(
        "credential_missing",
        "A valid Telegram bot token is required.",
      );
    if (
      credentials.allowedChatIds.length < 1 ||
      credentials.allowedChatIds.length > 100 ||
      credentials.allowedChatIds.some(
        (id) =>
          !/^-?[1-9]\d{0,19}$/.test(id) &&
          !/^@[A-Za-z][A-Za-z0-9_]{3,31}$/.test(id),
      )
    )
      throw new TelegramPersonalBotsApiError(
        "credential_missing",
        "One to 100 exact Telegram chat IDs or channel usernames are required.",
      );
  }

  private allowedChatId(
    credentials: TelegramPersonalBotsCredentials,
    value: unknown,
  ) {
    this.assertCredentials(credentials);
    const chatId = this.string(value);
    if (!chatId || !credentials.allowedChatIds.includes(chatId))
      throw new TelegramPersonalBotsApiError(
        "policy_blocked",
        "Telegram chat is outside the connection's allowed chat boundary.",
      );
    return chatId;
  }

  private updateChatId(value: unknown): string | null {
    const update = this.object(value);
    if (!update) return null;
    for (const key of [
      "message",
      "edited_message",
      "channel_post",
      "edited_channel_post",
      "my_chat_member",
      "chat_member",
      "chat_join_request",
    ]) {
      const chat = this.object(this.object(update[key])?.chat);
      const id = this.string(chat?.id);
      if (id) return id;
    }
    const callbackMessage = this.object(
      this.object(this.object(update.callback_query)?.message)?.chat,
    );
    return this.string(callbackMessage?.id);
  }

  private rejectCredentials(value: unknown) {
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      const object = this.object(entry);
      if (!object) return;
      for (const [key, child] of Object.entries(object)) {
        if (
          /(token|secret|password|authorization|credential|cookie)/i.test(key)
        )
          throw new TelegramPersonalBotsApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child);
      }
    };
    walk(value);
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 100).map((entry) => this.redact(entry));
    const object = this.object(value);
    if (!object) return value;
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(object).slice(0, 300))
      result[key] =
        /(token|secret|password|authorization|credential|cookie|phone_number)/i.test(
          key,
        )
          ? "[REDACTED]"
          : this.redact(entry);
    return result;
  }

  private requiredText(value: unknown, maximum: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > maximum)
      throw new TelegramPersonalBotsApiError(
        "provider_validation_error",
        `Telegram text must contain 1 to ${maximum} characters.`,
      );
    return text;
  }

  private integer(
    value: unknown,
    minimum: number,
    maximum: number,
    fallback?: number,
  ) {
    if (value === undefined && fallback !== undefined) return fallback;
    const number = this.number(value);
    if (
      number === null ||
      !Number.isInteger(number) ||
      number < minimum ||
      number > maximum
    )
      throw new TelegramPersonalBotsApiError(
        "provider_validation_error",
        `Telegram integer must be between ${minimum} and ${maximum}.`,
      );
    return number;
  }

  private safeDescription(value: unknown, botToken: string) {
    const description = this.string(value);
    if (!description) return null;
    return description
      .replaceAll(botToken, "[REDACTED]")
      .replace(/\d{5,20}:[A-Za-z0-9_-]{20,}/g, "[REDACTED]")
      .slice(0, 500);
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private string(value: unknown) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isSafeInteger(value))
      return String(value);
    return null;
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : null;
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }
}
