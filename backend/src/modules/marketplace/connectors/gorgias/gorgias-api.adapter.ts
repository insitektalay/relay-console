import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type GorgiasCredentials = {
  domain: string;
  username: string;
  apiKey: string;
};

export class GorgiasApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GorgiasApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: GorgiasCredentials) {
    await this.listTickets(credentials, { limit: 1 });
    return {
      apiOrigin: `https://${this.domain(credentials.domain)}.gorgias.com`,
      apiVersion: "current",
    };
  }

  async listTickets(
    credentials: GorgiasCredentials,
    input: { limit?: number },
  ) {
    const limit = this.integer(input.limit, 10, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/api/tickets",
      query: {
        limit,
        order_by: "created_datetime:desc",
        trashed: false,
      },
    });
    const body = this.record(result.data);
    const source = Array.isArray(body.data)
      ? body.data
      : Array.isArray(result.data)
        ? result.data
        : [];
    const meta = this.record(body.meta);
    return {
      tickets: source.slice(0, limit).map((value) => this.ticket(value)),
      hasNextPage: Boolean(meta.next_cursor ?? meta.next),
      limit,
    };
  }

  async getTicket(credentials: GorgiasCredentials, ticketId: number) {
    const id = this.positiveInteger(ticketId, "ticketId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/api/tickets/${id}`,
    });
    const body = this.record(result.data);
    return { ticket: this.ticket(body.data ?? body) };
  }

  async request(
    credentials: GorgiasCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const domain = this.domain(credentials.domain);
    const username = credentials.username.trim().toLowerCase();
    const apiKey = credentials.apiKey.trim();
    if (!username || !/^[^\s:@]+@[^\s:@]+\.[^\s:@]+$/.test(username))
      throw new GorgiasApiError(
        "credential_missing",
        "Gorgias API username is required.",
        401,
      );
    if (!apiKey)
      throw new GorgiasApiError(
        "credential_missing",
        "Gorgias API key is required.",
        401,
      );
    const method = input.method.trim().toUpperCase();
    const path = input.path.trim();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/api\/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$/.test(path) ||
      path.includes("..") ||
      path.includes("//") ||
      /[?#@\\]/.test(path)
    )
      throw new GorgiasApiError(
        "provider_validation_error",
        "Gorgias method or API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(`https://${domain}.gorgias.com${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key) ||
        !["string", "number", "boolean"].includes(typeof value)
      )
        throw new GorgiasApiError(
          "provider_validation_error",
          "Gorgias query must contain scalar values under valid keys.",
        );
      url.searchParams.set(key, String(value));
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new GorgiasApiError(
        "provider_validation_error",
        "Gorgias request body exceeds the 1 MB Relay boundary.",
      );
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`,
        "User-Agent": "RelayConsole-Gorgias/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new GorgiasApiError(
        "provider_validation_error",
        "Gorgias response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new GorgiasApiError(
        "provider_validation_error",
        "Gorgias response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new GorgiasApiError(
        "provider_validation_error",
        "Gorgias returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new GorgiasApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `Gorgias returned HTTP ${response.status}.`,
        response.status,
      );
    return {
      status: response.status,
      data: safe,
      rateLimit: {
        retryAfter: response.headers.get("retry-after"),
        accountLimit: response.headers.get("x-gorgias-account-api-call-limit"),
      },
    };
  }

  private ticket(value: unknown) {
    const item = this.record(value);
    return {
      ticketId: this.positiveInteger(item.id, "ticketId"),
      status: this.optionalText(item.status, 32),
      channel: this.optionalText(item.channel, 64),
      via: this.optionalText(item.via, 64),
      priority: this.optionalText(item.priority, 32),
      spam: item.spam === true,
      unread: item.is_unread === true,
      imported: item.imported === true,
      createdAt: this.dateTime(item.created_datetime),
      updatedAt: this.dateTime(item.updated_datetime),
      closedAt: this.dateTime(item.closed_datetime),
      snoozedUntil: this.dateTime(item.snooze_datetime),
    };
  }
  private domain(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.gorgias\.com\/?$/, "")
      .replace(/\/$/, "");
    if (
      !normalized ||
      normalized.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)
    )
      throw new GorgiasApiError(
        "provider_validation_error",
        "Gorgias domain must be the account name before .gorgias.com.",
      );
    return normalized;
  }
  private positiveInteger(value: unknown, label: string) {
    if (!Number.isSafeInteger(value) || Number(value) < 1)
      throw new GorgiasApiError(
        "provider_validation_error",
        `Gorgias ${label} must be a positive integer.`,
      );
    return Number(value);
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
        throw new GorgiasApiError(
          "policy_blocked",
          "Gorgias request is too deeply nested.",
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
          throw new GorgiasApiError(
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
