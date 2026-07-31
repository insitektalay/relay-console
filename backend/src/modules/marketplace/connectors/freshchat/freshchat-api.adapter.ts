import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type FreshchatCredentials = { accountUrl: string; apiKey: string };

export class FreshchatApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class FreshchatApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: FreshchatCredentials) {
    const result = await this.request(credentials, {
      method: "GET",
      path: "/v2/accounts/configuration",
    });
    const account = this.record(result.data);
    return {
      accountUrl: this.accountOrigin(credentials.accountUrl),
      accountId: this.optionalText(account.account_id, 128),
      accountDomain: this.optionalText(account.account_domain, 255),
    };
  }

  async getConversation(
    credentials: FreshchatCredentials,
    conversationId: string,
  ) {
    const id = this.identifier(conversationId, "conversationId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/v2/conversations/${id}`,
    });
    return { conversation: this.conversation(result.data) };
  }

  async listMessages(
    credentials: FreshchatCredentials,
    input: { conversationId: string; limit?: number },
  ) {
    const id = this.identifier(input.conversationId, "conversationId");
    const limit = this.integer(input.limit, 20, 1, 50);
    const result = await this.request(credentials, {
      method: "GET",
      path: `/v2/conversations/${id}/messages`,
      query: { page: 1, items_per_page: limit },
    });
    const body = this.record(result.data);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    return {
      messages: messages.slice(0, limit).map((value) => this.message(value)),
      page: 1,
      limit,
    };
  }

  async request(
    credentials: FreshchatCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const origin = this.accountOrigin(credentials.accountUrl);
    if (!credentials.apiKey.trim())
      throw new FreshchatApiError(
        "credential_missing",
        "Freshchat API key is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/v2\/[A-Za-z0-9_./-]+$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw new FreshchatApiError(
        "provider_validation_error",
        "Freshchat method or API v2 path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new FreshchatApiError(
        "provider_validation_error",
        "Freshchat request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(input.path, `${origin}/`);
    this.appendQuery(url.searchParams, input.query);
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.apiKey}`,
        "User-Agent": "RelayConsole-Freshchat/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new FreshchatApiError(
        "provider_validation_error",
        "Freshchat response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new FreshchatApiError(
        "provider_validation_error",
        "Freshchat response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new FreshchatApiError(
        "provider_validation_error",
        "Freshchat returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new FreshchatApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ??
          `Freshchat returned HTTP ${response.status}.`,
        response.status,
      );
    return {
      status: response.status,
      data: safe,
      rateLimit: {
        limit: response.headers.get("x-ratelimit-limit"),
        remaining: response.headers.get("x-ratelimit-remaining"),
        reset: response.headers.get("x-ratelimitreset"),
      },
    };
  }

  private conversation(value: unknown) {
    const item = this.record(value);
    return {
      conversationId: this.identifier(item.conversation_id, "conversationId"),
      status: this.optionalText(item.status, 50),
      priority: this.optionalText(item.priority, 50),
      channelId: this.optionalText(item.channel_id, 128),
      assignedAgentId: this.optionalText(item.assigned_agent_id, 128),
      assignedGroupId: this.optionalText(item.assigned_group_id, 128),
      createdAt: this.dateTime(item.created_time ?? item.created_at),
      updatedAt: this.dateTime(item.updated_time ?? item.updated_at),
    };
  }

  private message(value: unknown) {
    const item = this.record(value);
    return {
      messageId: this.identifier(item.message_id, "messageId"),
      actorType: this.optionalText(item.actor_type, 50),
      messageType: this.optionalText(item.message_type, 50),
      createdAt: this.dateTime(item.created_time ?? item.created_at),
    };
  }

  private accountOrigin(value: string) {
    const candidate = /^https?:\/\//i.test(value.trim())
      ? value.trim()
      : `https://${value.trim()}`;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new FreshchatApiError(
        "provider_validation_error",
        "Freshchat account URL is invalid.",
      );
    }
    const hostname = url.hostname.toLowerCase();
    const validHost =
      /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.freshchat\.com$/.test(hostname) ||
      /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.myfreshworks\.com$/.test(hostname);
    if (
      url.protocol !== "https:" ||
      !validHost ||
      url.port ||
      url.username ||
      url.password ||
      (url.pathname !== "/" &&
        url.pathname !== "/v2" &&
        url.pathname !== "/v2/") ||
      url.search ||
      url.hash
    )
      throw new FreshchatApiError(
        "provider_validation_error",
        "Freshchat account URL must be an HTTPS freshchat.com or myfreshworks.com chat account origin.",
      );
    return `https://${hostname}`;
  }

  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 128 || !/^[A-Za-z0-9_-]+$/.test(text))
      throw new FreshchatApiError(
        "provider_validation_error",
        `Freshchat ${label} is invalid.`,
      );
    return text;
  }

  private optionalText(value: unknown, maximum: number) {
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    return typeof value === "string"
      ? value.trim().slice(0, maximum) || null
      : null;
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
    const text = this.optionalText(value, 40);
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
        throw new FreshchatApiError(
          "policy_blocked",
          "Freshchat request is too deeply nested.",
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
          throw new FreshchatApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw new FreshchatApiError(
        "provider_validation_error",
        "Freshchat query has too many fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item.slice(0, 100) : [item];
      values.forEach((entry) =>
        params.append(key, String(entry).slice(0, 10_000)),
      );
    }
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
    const candidate = object.message ?? object.description ?? object.error;
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
