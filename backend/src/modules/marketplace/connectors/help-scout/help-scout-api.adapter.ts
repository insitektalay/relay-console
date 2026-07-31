import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type HelpScoutCredentials = {
  accessToken: string;
  userId: string;
};

export class HelpScoutApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class HelpScoutApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: HelpScoutCredentials) {
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/v2/users/me",
      }),
    );
    const userId = this.id(body.id);
    if (!userId || userId !== credentials.userId || body.active === false) {
      throw new HelpScoutApiError(
        "insufficient_scope",
        "Help Scout authorizing-user binding changed or is inactive.",
        403,
      );
    }
    return {
      userId,
      displayName: this.displayName(body),
      role: this.text(body.role, 100),
      active: body.active !== false,
    };
  }

  async conversationCount(credentials: HelpScoutCredentials) {
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/v2/conversations",
        query: { page: 1 },
      }),
    );
    return { totalCount: this.number(this.record(body.page).totalElements) };
  }

  async listConversations(
    credentials: HelpScoutCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/v2/conversations",
        query: {
          status: "active",
          sortField: "createdAt",
          sortOrder: "desc",
          page: 1,
        },
      }),
    );
    return {
      totalCount: this.number(this.record(body.page).totalElements),
      conversations: this.array(this.record(body._embedded).conversations)
        .slice(0, limit)
        .map((item) => this.conversation(item)),
    };
  }

  async getConversation(
    credentials: HelpScoutCredentials,
    input: { conversationId: string },
  ) {
    const id = this.conversationId(input.conversationId);
    const body = await this.rawRequest(credentials, {
      method: "GET",
      path: `/v2/conversations/${id}`,
    });
    return { conversation: this.conversation(body) };
  }

  async request(
    credentials: HelpScoutCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const data = await this.rawRequest(credentials, input);
    return { data: this.redact(data) };
  }

  private async rawRequest(
    credentials: HelpScoutCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (!credentials.accessToken.trim()) {
      throw new HelpScoutApiError(
        "credential_missing",
        "Help Scout access token is required.",
        401,
      );
    }
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/v2\/[A-Za-z0-9_./-]+$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    ) {
      throw new HelpScoutApiError(
        "provider_validation_error",
        "Help Scout method or Mailbox API v2 path is invalid.",
      );
    }
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const serialized = input.json ? JSON.stringify(input.json) : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000) {
      throw new HelpScoutApiError(
        "provider_validation_error",
        "Help Scout request body exceeds the 1 MB Relay boundary.",
      );
    }
    const url = new URL(`https://api.helpscout.net${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "RelayConsole-HelpScout/1.0",
      },
      body: serialized,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000) {
      throw new HelpScoutApiError(
        "provider_validation_error",
        "Help Scout response exceeds the 2 MB Relay boundary.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000) {
      throw new HelpScoutApiError(
        "provider_validation_error",
        "Help Scout response exceeds the 2 MB Relay boundary.",
      );
    }
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok) {
      throw new HelpScoutApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ??
          `Help Scout returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return body;
  }

  private conversation(value: unknown) {
    const item = this.record(value);
    return {
      conversationId: this.id(item.id),
      number: this.number(item.number),
      threads: this.number(item.threads),
      type: this.text(item.type, 50),
      status: this.text(item.status, 50),
      state: this.text(item.state, 50),
      mailboxId: this.id(item.mailboxId),
      folderId: this.id(item.folderId),
      createdAt: this.dateTime(item.createdAt),
      closedAt: this.dateTime(item.closedAt),
      waitingSince: this.dateTime(item.waitingSince),
      snoozedUntil: this.dateTime(item.snoozedUntil),
    };
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new HelpScoutApiError(
          "policy_blocked",
          "Help Scout request is too deeply nested.",
          403,
        );
      if (Array.isArray(item)) {
        item.forEach((entry) => walk(entry, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new HelpScoutApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    walk(value);
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw new HelpScoutApiError(
        "provider_validation_error",
        "Help Scout query has too many fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item.slice(0, 100) : [item];
      values.forEach((entry) =>
        params.append(key.slice(0, 200), String(entry).slice(0, 10_000)),
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

  private displayName(user: JsonObject) {
    const first = this.text(user.firstName, 100);
    const last = this.text(user.lastName, 100);
    return [first, last].filter(Boolean).join(" ").slice(0, 200) || null;
  }

  private errorMessage(value: unknown) {
    const body = this.record(value);
    const candidate = body.message ?? body.error_description ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private conversationId(value: string) {
    if (!/^[1-9][0-9]{0,19}$/.test(value))
      throw new HelpScoutApiError(
        "provider_validation_error",
        "Help Scout conversation ID is invalid.",
      );
    return value;
  }

  private limit(value?: number) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || value < 1 || value > 25)
      throw new HelpScoutApiError(
        "provider_validation_error",
        "Help Scout conversation limit must be between 1 and 25.",
      );
    return value;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private id(value: unknown) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
      return String(value);
    const text = this.text(value, 200);
    return text && /^[A-Za-z0-9_-]{1,200}$/.test(text) ? text : null;
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private text(value: unknown, limit: number) {
    return typeof value === "string" ? value.slice(0, limit) : null;
  }

  private dateTime(value: unknown) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value))
      ? new Date(value).toISOString()
      : null;
  }
}
