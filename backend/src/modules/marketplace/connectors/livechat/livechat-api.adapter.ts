import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type LiveChatCredentials = { personalAccessToken: string };

export class LiveChatApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class LiveChatApiAdapter {
  private readonly origin = "https://api.livechatinc.com";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: LiveChatCredentials) {
    await this.listChats(credentials, { limit: 1 });
    return { apiOrigin: this.origin, apiVersion: "3.5" };
  }

  async listChats(credentials: LiveChatCredentials, input: { limit?: number }) {
    const limit = this.integer(input.limit, 25, 1, 25);
    const result = await this.request(credentials, {
      action: "list_chats",
      json: {
        limit,
        sort_order: "desc",
        filters: { include_active: true, include_chats_without_threads: false },
      },
    });
    const body = this.record(result.data);
    const chats = Array.isArray(body.chats_summary)
      ? body.chats_summary
      : Array.isArray(body.chats)
        ? body.chats
        : [];
    return {
      chats: chats.slice(0, limit).map((value) => this.chat(value)),
      hasNextPage: typeof body.next_page_id === "string",
      limit,
    };
  }

  async getChat(credentials: LiveChatCredentials, chatId: string) {
    const id = this.identifier(chatId, "chatId");
    const result = await this.request(credentials, {
      action: "get_chat",
      json: { chat_id: id },
    });
    return { chat: this.chat(result.data) };
  }

  async request(
    credentials: LiveChatCredentials,
    input: { action: string; json?: JsonObject },
  ) {
    const token = credentials.personalAccessToken.trim();
    if (!token)
      throw new LiveChatApiError(
        "credential_missing",
        "LiveChat personal access token is required.",
        401,
      );
    const action = input.action.trim();
    if (!/^[a-z][a-z0-9_]{0,99}$/.test(action))
      throw new LiveChatApiError(
        "provider_validation_error",
        "LiveChat Agent Chat API action is invalid.",
      );
    this.rejectCredentialFields(input.json);
    const body = JSON.stringify(input.json ?? {});
    if (Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new LiveChatApiError(
        "provider_validation_error",
        "LiveChat request body exceeds the 1 MB Relay boundary.",
      );
    const response = await this.requester(
      `${this.origin}/v3.5/agent/action/${action}`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${token}`,
          "User-Agent": "RelayConsole-LiveChat/1.0",
        },
        body,
      },
    );
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new LiveChatApiError(
        "provider_validation_error",
        "LiveChat response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new LiveChatApiError(
        "provider_validation_error",
        "LiveChat response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new LiveChatApiError(
        "provider_validation_error",
        "LiveChat returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new LiveChatApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `LiveChat returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private chat(value: unknown) {
    const item = this.record(value);
    const thread = this.record(item.thread ?? item.last_thread_summary);
    const threads = Array.isArray(item.threads) ? item.threads : [];
    const selectedThread = Object.keys(thread).length
      ? thread
      : this.record(threads[0]);
    const access = this.record(selectedThread.access ?? item.access);
    return {
      chatId: this.identifier(item.id, "chatId"),
      threadId: this.optionalIdentifier(selectedThread.id),
      threadActive:
        typeof selectedThread.active === "boolean"
          ? selectedThread.active
          : null,
      threadCreatedAt: this.dateTime(selectedThread.created_at),
      threadCount: threads.length || this.optionalCount(item.threads_count),
      eventCount: Array.isArray(selectedThread.events)
        ? selectedThread.events.length
        : this.optionalCount(selectedThread.events_count),
      participantCount: Array.isArray(item.users) ? item.users.length : null,
      groupIds: Array.isArray(access.group_ids)
        ? access.group_ids
            .filter((value) => Number.isSafeInteger(value))
            .slice(0, 200)
        : [],
    };
  }

  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 128 || !/^[A-Za-z0-9_-]+$/.test(text))
      throw new LiveChatApiError(
        "provider_validation_error",
        `LiveChat ${label} is invalid.`,
      );
    return text;
  }
  private optionalIdentifier(value: unknown) {
    const text = typeof value === "string" ? value.trim() : "";
    return text && text.length <= 128 && /^[A-Za-z0-9_-]+$/.test(text)
      ? text
      : null;
  }
  private optionalCount(value: unknown) {
    return Number.isSafeInteger(value) && Number(value) >= 0
      ? Number(value)
      : 0;
  }
  private integer(
    value: unknown,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    return Number.isInteger(value) &&
      Number(value) >= minimum &&
      Number(value) <= maximum
      ? Number(value)
      : fallback;
  }
  private dateTime(value: unknown) {
    const text = typeof value === "string" ? value.trim().slice(0, 40) : "";
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }
  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private rejectCredentialFields(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new LiveChatApiError(
          "policy_blocked",
          "LiveChat request is too deeply nested.",
          403,
        );
      if (Array.isArray(item))
        return item.forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new LiveChatApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value))
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }
  private errorMessage(value: unknown) {
    const object = this.record(value);
    const error = this.record(object.error);
    const candidate = error.message ?? object.message ?? object.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
