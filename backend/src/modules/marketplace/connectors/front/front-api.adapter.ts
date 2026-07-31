import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type FrontCredentials = {
  accessToken: string;
  companyId: string;
};

export class FrontApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class FrontApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: FrontCredentials) {
    const body = this.record(
      await this.rawRequest(credentials, { method: "GET", path: "/me" }),
    );
    const companyId = this.resourceId(body.id, "cmp");
    if (!companyId || companyId !== credentials.companyId) {
      throw new FrontApiError(
        "insufficient_scope",
        "Front company binding changed or is no longer available.",
        403,
      );
    }
    return {
      companyId,
      companyName: this.text(body.name, 200),
    };
  }

  async listConversations(
    credentials: FrontCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/conversations",
        query: { limit, sort_by: "date", sort_order: "desc" },
      }),
    );
    return {
      conversations: this.array(body._results)
        .slice(0, limit)
        .map((item) => this.conversation(item)),
      hasMore: Boolean(this.record(body._pagination).next),
    };
  }

  async getConversation(
    credentials: FrontCredentials,
    input: { conversationId: string },
  ) {
    const conversationId = this.conversationId(input.conversationId);
    const body = await this.rawRequest(credentials, {
      method: "GET",
      path: `/conversations/${conversationId}`,
    });
    return { conversation: this.conversation(body) };
  }

  async request(
    credentials: FrontCredentials,
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
    credentials: FrontCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (!credentials.accessToken.trim()) {
      throw new FrontApiError(
        "credential_missing",
        "Front access token is required.",
        401,
      );
    }
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/[A-Za-z0-9_./:@+-]*$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    ) {
      throw new FrontApiError(
        "provider_validation_error",
        "Front method or Core API path is invalid.",
      );
    }
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const serialized = input.json ? JSON.stringify(input.json) : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000) {
      throw new FrontApiError(
        "provider_validation_error",
        "Front request body exceeds the 1 MB Relay boundary.",
      );
    }
    const url = new URL(`https://api2.frontapp.com${input.path}`);
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
        "User-Agent": "RelayConsole-Front/1.0",
      },
      body: serialized,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000) {
      throw new FrontApiError(
        "provider_validation_error",
        "Front response exceeds the 2 MB Relay boundary.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000) {
      throw new FrontApiError(
        "provider_validation_error",
        "Front response exceeds the 2 MB Relay boundary.",
      );
    }
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok) {
      throw new FrontApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ?? `Front returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return body;
  }

  private conversation(value: unknown) {
    const item = this.record(value);
    return {
      conversationId: this.resourceId(item.id, "cnv"),
      subject: this.text(item.subject, 500),
      status: this.text(item.status, 50),
      statusId: this.resourceId(item.status_id, "sts"),
      statusCategory: this.text(item.status_category, 50),
      ticketIds: this.array(item.ticket_ids)
        .map((entry) => this.text(entry, 100))
        .filter((entry): entry is string => Boolean(entry))
        .slice(0, 25),
      isPrivate: typeof item.is_private === "boolean" ? item.is_private : null,
      createdAt: this.unixTime(item.created_at),
      waitingSince: this.unixTime(item.waiting_since),
    };
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new FrontApiError(
          "policy_blocked",
          "Front request is too deeply nested.",
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
          throw new FrontApiError(
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
      throw new FrontApiError(
        "provider_validation_error",
        "Front query has too many fields.",
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

  private errorMessage(value: unknown) {
    const body = this.record(value);
    const errors = this.array(body._error);
    const first = this.record(errors[0]);
    const candidate =
      first.message ?? body.message ?? body.error_description ?? body.error;
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
    const id = this.resourceId(value, "cnv");
    if (!id)
      throw new FrontApiError(
        "provider_validation_error",
        "Front conversation ID is invalid.",
      );
    return id;
  }

  private limit(value?: number) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || value < 1 || value > 25)
      throw new FrontApiError(
        "provider_validation_error",
        "Front conversation limit must be between 1 and 25.",
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

  private resourceId(value: unknown, prefix: string) {
    const text = this.text(value, 200);
    return text && new RegExp(`^${prefix}_[A-Za-z0-9_-]{1,190}$`).test(text)
      ? text
      : null;
  }

  private text(value: unknown, limit: number) {
    return typeof value === "string" ? value.slice(0, limit) : null;
  }

  private unixTime(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? new Date(value * 1000).toISOString()
      : null;
  }
}
