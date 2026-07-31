import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type KustomerCredentials = { apiKey: string };

export class KustomerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class KustomerApiAdapter {
  private readonly origin = "https://api.kustomerapp.com";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: KustomerCredentials) {
    await this.listConversations(credentials, { limit: 1 });
    return { apiOrigin: this.origin, apiVersion: "v1" };
  }

  async listConversations(
    credentials: KustomerCredentials,
    input: { limit?: number },
  ) {
    const limit = this.integer(input.limit, 10, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/v1/conversations",
      query: { page: 1, pageSize: limit },
    });
    const body = this.record(result.data);
    const source = Array.isArray(body.data) ? body.data : [];
    const links = this.record(body.links);
    const page = this.record(this.record(body.meta).page);
    return {
      conversations: source
        .slice(0, limit)
        .map((value) => this.conversation(value)),
      hasNextPage: Boolean(links.next ?? page.next),
      limit,
    };
  }

  async getConversation(
    credentials: KustomerCredentials,
    conversationId: string,
  ) {
    const id = this.id(conversationId, "conversationId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/v1/conversations/${id}`,
    });
    const body = this.record(result.data);
    return { conversation: this.conversation(body.data ?? body) };
  }

  async request(
    credentials: KustomerCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const apiKey = credentials.apiKey.trim();
    if (!apiKey)
      throw new KustomerApiError(
        "credential_missing",
        "Kustomer API key is required.",
        401,
      );
    const method = input.method.trim().toUpperCase();
    const path = input.path.trim();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/v1\/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$/.test(path) ||
      path.includes("..") ||
      path.includes("//") ||
      /[?#@\\]/.test(path)
    )
      throw new KustomerApiError(
        "provider_validation_error",
        "Kustomer method or API v1 path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(`${this.origin}${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key) ||
        !["string", "number", "boolean"].includes(typeof value)
      )
        throw new KustomerApiError(
          "provider_validation_error",
          "Kustomer query must contain scalar values under valid keys.",
        );
      url.searchParams.set(key, String(value));
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new KustomerApiError(
        "provider_validation_error",
        "Kustomer request body exceeds the 1 MB Relay boundary.",
      );
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "RelayConsole-Kustomer/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new KustomerApiError(
        "provider_validation_error",
        "Kustomer response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new KustomerApiError(
        "provider_validation_error",
        "Kustomer response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new KustomerApiError(
        "provider_validation_error",
        "Kustomer returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new KustomerApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `Kustomer returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private conversation(value: unknown) {
    const item = this.record(value);
    const attributes = this.record(item.attributes);
    const channels = Array.isArray(attributes.channels)
      ? attributes.channels
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, 20)
          .map((entry) => entry.slice(0, 64))
      : [];
    return {
      conversationId: this.id(item.id, "conversationId"),
      status: this.optionalText(attributes.status, 32),
      channels,
      messageCount: this.count(attributes.messageCount),
      noteCount: this.count(attributes.noteCount),
      spam: attributes.spam === true,
      createdAt: this.dateTime(attributes.createdAt),
      updatedAt: this.dateTime(attributes.updatedAt),
      lastActivityAt: this.dateTime(attributes.lastActivityAt),
    };
  }

  private id(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 128 || !/^[A-Za-z0-9_-]+$/.test(text))
      throw new KustomerApiError(
        "provider_validation_error",
        `Kustomer ${label} is invalid.`,
      );
    return text;
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
        throw new KustomerApiError(
          "policy_blocked",
          "Kustomer request is too deeply nested.",
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
          throw new KustomerApiError(
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
