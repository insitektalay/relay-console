import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type ReAmazeCredentials = {
  brand: string;
  loginEmail: string;
  apiToken: string;
};

export class ReAmazeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ReAmazeApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: ReAmazeCredentials) {
    await this.listConversations(credentials, { limit: 1 });
    return {
      apiOrigin: `https://${this.brand(credentials.brand)}.reamaze.io`,
      apiVersion: "v1",
    };
  }

  async listConversations(
    credentials: ReAmazeCredentials,
    input: { limit?: number },
  ) {
    const limit = this.integer(input.limit, 10, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/api/v1/conversations",
      query: { page: 1, sort: "changed" },
    });
    const body = this.record(result.data);
    const source = Array.isArray(body.conversations) ? body.conversations : [];
    return {
      conversations: source
        .slice(0, limit)
        .map((value) => this.conversation(value)),
      hasNextPage:
        this.integer(body.page_count, 1, 1, Number.MAX_SAFE_INTEGER) > 1,
      limit,
    };
  }

  async getConversation(
    credentials: ReAmazeCredentials,
    conversationSlug: string,
  ) {
    const slug = this.slug(conversationSlug);
    const result = await this.request(credentials, {
      method: "GET",
      path: `/api/v1/conversations/${slug}`,
    });
    return { conversation: this.conversation(result.data) };
  }

  async request(
    credentials: ReAmazeCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const brand = this.brand(credentials.brand);
    const email = credentials.loginEmail.trim().toLowerCase();
    const token = credentials.apiToken.trim();
    if (!email || !/^[^\s:@]+@[^\s:@]+\.[^\s:@]+$/.test(email))
      throw new ReAmazeApiError(
        "credential_missing",
        "Re:amaze login email is required.",
        401,
      );
    if (!token)
      throw new ReAmazeApiError(
        "credential_missing",
        "Re:amaze API token is required.",
        401,
      );
    const method = input.method.trim().toUpperCase();
    const path = input.path.trim();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/api\/v1\/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$/.test(path) ||
      path.includes("..") ||
      path.includes("//") ||
      /[?#@\\]/.test(path)
    )
      throw new ReAmazeApiError(
        "provider_validation_error",
        "Re:amaze method or API v1 path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(`https://${brand}.reamaze.io${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key) ||
        !["string", "number", "boolean"].includes(typeof value)
      )
        throw new ReAmazeApiError(
          "provider_validation_error",
          "Re:amaze query must contain scalar values under valid keys.",
        );
      url.searchParams.set(key, String(value));
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new ReAmazeApiError(
        "provider_validation_error",
        "Re:amaze request body exceeds the 1 MB Relay boundary.",
      );
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
        "User-Agent": "RelayConsole-ReAmaze/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new ReAmazeApiError(
        "provider_validation_error",
        "Re:amaze response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new ReAmazeApiError(
        "provider_validation_error",
        "Re:amaze response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new ReAmazeApiError(
        "provider_validation_error",
        "Re:amaze returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new ReAmazeApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `Re:amaze returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private conversation(value: unknown) {
    const item = this.record(value);
    const category = this.record(item.category);
    const lastCustomerMessage = this.record(item.last_customer_message);
    const status = this.integer(item.status, -1, 0, 9);
    return {
      conversationSlug: this.slug(item.slug),
      statusCode: status,
      status:
        [
          "open",
          "responded",
          "done",
          "spam",
          "archived",
          "on_hold",
          "auto_done",
          "ai_agent_assigned",
          "ai_agent_done",
          "ai_spam",
        ][status] ?? "unknown",
      channelCode: this.integer(category.channel, -1, 0, 99),
      createdAt: this.dateTime(item.created_at),
      lastCustomerMessageAt: this.dateTime(lastCustomerMessage.created_at),
    };
  }
  private brand(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.reamaze\.io\/?$/, "")
      .replace(/\/$/, "");
    if (
      !normalized ||
      normalized.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)
    )
      throw new ReAmazeApiError(
        "provider_validation_error",
        "Re:amaze brand must be the hostname label before .reamaze.io.",
      );
    return normalized;
  }
  private slug(value: unknown) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 200 || !/^[A-Za-z0-9_-]+$/.test(text))
      throw new ReAmazeApiError(
        "provider_validation_error",
        "Re:amaze conversationSlug is invalid.",
      );
    return text;
  }
  private dateTime(value: unknown) {
    const text = typeof value === "string" ? value.trim().slice(0, 40) : "";
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }
  private integer(value: unknown, fallback: number, min: number, max: number) {
    return Number.isInteger(value) &&
      Number(value) >= min &&
      Number(value) <= max
      ? Number(value)
      : fallback;
  }
  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private rejectCredentialFields(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new ReAmazeApiError(
          "policy_blocked",
          "Re:amaze request is too deeply nested.",
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
          throw new ReAmazeApiError(
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
    const candidate = object.detail ?? object.message ?? object.error;
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
