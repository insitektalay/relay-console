import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type UserlikeCredentials = { organizationToken: string };
export class UserlikeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
export class UserlikeApiAdapter {
  private readonly origin = "https://api.userlike.com";
  private readonly base = "/api/um/v3";
  constructor(private readonly requester: Requester = fetch) {}
  async health(credentials: UserlikeCredentials) {
    await this.listConversations(credentials, { limit: 1 });
    return { apiOrigin: this.origin, apiVersion: "v3" };
  }
  async listConversations(
    credentials: UserlikeCredentials,
    input: { limit?: number },
  ) {
    const limit = this.integer(input.limit, 10, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/conversations/",
      query: { limit },
    });
    const body = this.record(result.data);
    const source = Array.isArray(body.results) ? body.results : [];
    return {
      conversations: source
        .slice(0, limit)
        .map((value) => this.conversation(value)),
      hasNextPage: typeof body.next === "string",
      limit,
    };
  }
  async getConversation(
    credentials: UserlikeCredentials,
    conversationId: number,
  ) {
    const id = this.id(conversationId);
    const result = await this.request(credentials, {
      method: "GET",
      path: `/conversations/${id}/`,
    });
    return { conversation: this.conversation(result.data) };
  }
  async request(
    credentials: UserlikeCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const token = credentials.organizationToken.trim();
    if (!token)
      throw new UserlikeApiError(
        "credential_missing",
        "Userlike organization authentication token is required.",
        401,
      );
    const method = input.method.trim().toUpperCase();
    if (!/^(GET|POST|PATCH|DELETE)$/.test(method))
      throw new UserlikeApiError(
        "provider_validation_error",
        "Userlike JSON API method is invalid.",
      );
    const path = input.path.trim();
    if (
      !/^\/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$/.test(path) ||
      path.includes("..") ||
      path.includes("//") ||
      /[?#@\\]/.test(path)
    )
      throw new UserlikeApiError(
        "provider_validation_error",
        "Userlike JSON API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(`${this.origin}${this.base}${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key) ||
        !["string", "number", "boolean"].includes(typeof value)
      )
        throw new UserlikeApiError(
          "provider_validation_error",
          "Userlike query must contain scalar values under valid keys.",
        );
      url.searchParams.set(key, String(value));
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new UserlikeApiError(
        "provider_validation_error",
        "Userlike request body exceeds the 1 MB Relay boundary.",
      );
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: token,
        "User-Agent": "RelayConsole-Userlike/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new UserlikeApiError(
        "provider_validation_error",
        "Userlike response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new UserlikeApiError(
        "provider_validation_error",
        "Userlike response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new UserlikeApiError(
        "provider_validation_error",
        "Userlike returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new UserlikeApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `Userlike returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }
  private conversation(value: unknown) {
    const item = this.record(value);
    return {
      conversationId: this.id(item.id),
      status: this.optionalText(item.status ?? item.state, 32),
      channel: this.optionalText(item.channel ?? item.channel_type, 64),
      operatorId: this.optionalId(item.operator_id),
      widgetId: this.optionalId(item.widget_id),
      createdAt: this.dateTime(item.created_at),
      updatedAt: this.dateTime(item.updated_at),
      messageCount: this.count(item.message_count),
      noteCount: this.count(item.note_count),
    };
  }
  private id(value: unknown) {
    const id =
      typeof value === "number"
        ? value
        : typeof value === "string" && /^\d+$/.test(value)
          ? Number(value)
          : NaN;
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new UserlikeApiError(
        "provider_validation_error",
        "Userlike conversationId is invalid.",
      );
    return id;
  }
  private optionalId(value: unknown) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    return text && text.length <= 128 && /^[A-Za-z0-9_-]+$/.test(text)
      ? text
      : null;
  }
  private optionalText(value: unknown, max: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, max)
      : null;
  }
  private dateTime(value: unknown) {
    const text = typeof value === "string" ? value.trim().slice(0, 40) : "";
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }
  private count(value: unknown) {
    return Number.isSafeInteger(value) && Number(value) >= 0
      ? Number(value)
      : 0;
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
        throw new UserlikeApiError(
          "policy_blocked",
          "Userlike request is too deeply nested.",
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
          throw new UserlikeApiError(
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
