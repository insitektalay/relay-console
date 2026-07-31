import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type CrispCredentials = {
  websiteId: string;
  tokenIdentifier: string;
  tokenKey: string;
};

export class CrispApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class CrispApiAdapter {
  private readonly origin = "https://api.crisp.chat";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: CrispCredentials) {
    await this.listConversations(credentials, { limit: 20 });
    return {
      apiOrigin: this.origin,
      apiVersion: "v1",
      websiteId: this.identifier(credentials.websiteId, "websiteId"),
    };
  }

  async listConversations(
    credentials: CrispCredentials,
    input: { limit?: number },
  ) {
    const limit = this.integer(input.limit, 20, 20, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/conversations/1",
      query: { per_page: limit },
    });
    const envelope = this.record(result.data);
    const source = Array.isArray(envelope.data) ? envelope.data : [];
    return {
      conversations: source
        .slice(0, limit)
        .map((value) => this.conversation(value)),
      limit,
      hasNextPage: result.status === 206,
    };
  }

  async getConversationState(credentials: CrispCredentials, sessionId: string) {
    const id = this.identifier(sessionId, "sessionId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/conversation/${encodeURIComponent(id)}/state`,
    });
    const envelope = this.record(result.data);
    const data = this.record(envelope.data);
    return {
      conversation: {
        sessionId: id,
        state: this.optionalText(data.state, 32),
      },
    };
  }

  async request(
    credentials: CrispCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const websiteId = this.identifier(credentials.websiteId, "websiteId");
    const identifier = credentials.tokenIdentifier.trim();
    const key = credentials.tokenKey.trim();
    if (!identifier || !key)
      throw new CrispApiError(
        "credential_missing",
        "Crisp website token identifier and key are required.",
        401,
      );
    const method = input.method.trim().toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method))
      throw new CrispApiError(
        "provider_validation_error",
        "Crisp REST API method is invalid.",
      );
    const path = input.path.trim();
    if (
      !/^\/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$/.test(path) ||
      path.includes("..") ||
      path.includes("//") ||
      /[?#@\\]/.test(path)
    )
      throw new CrispApiError(
        "provider_validation_error",
        "Crisp website-relative API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(
      `${this.origin}/v1/website/${encodeURIComponent(websiteId)}${path}`,
    );
    for (const [queryKey, value] of Object.entries(input.query ?? {})) {
      if (!/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(queryKey))
        throw new CrispApiError(
          "provider_validation_error",
          "Crisp query key is invalid.",
        );
      if (["string", "number", "boolean"].includes(typeof value))
        url.searchParams.set(queryKey, String(value));
      else
        throw new CrispApiError(
          "provider_validation_error",
          "Crisp query values must be scalar.",
        );
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new CrispApiError(
        "provider_validation_error",
        "Crisp request body exceeds the 1 MB Relay boundary.",
      );
    const authorization = Buffer.from(`${identifier}:${key}`, "utf8").toString(
      "base64",
    );
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Basic ${authorization}`,
        "X-Crisp-Tier": "website",
        "User-Agent": "RelayConsole-Crisp/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new CrispApiError(
        "provider_validation_error",
        "Crisp response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new CrispApiError(
        "provider_validation_error",
        "Crisp response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new CrispApiError(
        "provider_validation_error",
        "Crisp returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new CrispApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `Crisp returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private conversation(value: unknown) {
    const item = this.record(value);
    const unread = this.record(item.unread);
    const assigned = this.record(item.assigned);
    return {
      sessionId: this.identifier(item.session_id, "sessionId"),
      inboxId: this.optionalIdentifier(item.inbox_id),
      state: this.optionalText(item.state, 32),
      status: Number.isSafeInteger(item.status) ? Number(item.status) : null,
      verified: typeof item.is_verified === "boolean" ? item.is_verified : null,
      blocked: typeof item.is_blocked === "boolean" ? item.is_blocked : null,
      availability: this.optionalText(item.availability, 32),
      operatorUnread: this.optionalCount(unread.operator),
      visitorUnread: this.optionalCount(unread.visitor),
      assignedOperatorId: this.optionalIdentifier(assigned.user_id),
      createdAt: this.timestamp(item.created_at),
      updatedAt: this.timestamp(item.updated_at),
      waitingSince: this.timestamp(item.waiting_since),
    };
  }

  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 128 || !/^[A-Za-z0-9_-]+$/.test(text))
      throw new CrispApiError(
        "provider_validation_error",
        `Crisp ${label} is invalid.`,
      );
    return text;
  }
  private optionalIdentifier(value: unknown) {
    const text = typeof value === "string" ? value.trim() : "";
    return text && text.length <= 128 && /^[A-Za-z0-9_-]+$/.test(text)
      ? text
      : null;
  }
  private optionalText(value: unknown, maximum: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maximum)
      : null;
  }
  private optionalCount(value: unknown) {
    return Number.isSafeInteger(value) && Number(value) >= 0
      ? Number(value)
      : 0;
  }
  private timestamp(value: unknown) {
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
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
  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private rejectCredentialFields(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new CrispApiError(
          "policy_blocked",
          "Crisp request is too deeply nested.",
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
          throw new CrispApiError(
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
    const candidate = object.reason ?? object.message ?? object.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 402 || status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
