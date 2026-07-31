import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type FreshserviceCredentials = { domain: string; apiKey: string };

export class FreshserviceApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class FreshserviceApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: FreshserviceCredentials) {
    const result = await this.request(credentials, {
      method: "GET",
      path: "/api/v2/tickets",
      query: { page: 1, per_page: 1 },
    });
    return { domain: this.domain(credentials.domain), status: result.status };
  }

  async listTickets(
    credentials: FreshserviceCredentials,
    input: { limit?: number; workspaceId?: number },
  ) {
    const limit = this.integer(input.limit, 25, 1, 25);
    const workspaceId =
      input.workspaceId === undefined
        ? undefined
        : this.positiveInteger(input.workspaceId, "workspaceId");
    const result = await this.request(credentials, {
      method: "GET",
      path: "/api/v2/tickets",
      query: { page: 1, per_page: limit, workspace_id: workspaceId },
    });
    const body = this.record(result.data);
    const tickets = Array.isArray(body.tickets) ? body.tickets : [];
    return {
      tickets: tickets.slice(0, limit).map((value) => this.ticket(value)),
      hasNextPage: Boolean(result.pagination.link),
    };
  }

  async getTicket(credentials: FreshserviceCredentials, ticketId: number) {
    const id = this.positiveInteger(ticketId, "ticketId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/api/v2/tickets/${id}`,
    });
    const ticket = this.record(result.data).ticket;
    return { ticket: this.ticket(ticket) };
  }

  async request(
    credentials: FreshserviceCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const domain = this.domain(credentials.domain);
    if (!credentials.apiKey.trim())
      throw new FreshserviceApiError(
        "credential_missing",
        "Freshservice API key is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/api\/v2\/[A-Za-z0-9_./-]+$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw new FreshserviceApiError(
        "provider_validation_error",
        "Freshservice method or API v2 path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new FreshserviceApiError(
        "provider_validation_error",
        "Freshservice request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(`https://${domain}.freshservice.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:X`).toString("base64")}`,
        "User-Agent": "RelayConsole-Freshservice/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new FreshserviceApiError(
        "provider_validation_error",
        "Freshservice response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new FreshserviceApiError(
        "provider_validation_error",
        "Freshservice response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new FreshserviceApiError(
        "provider_validation_error",
        "Freshservice returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new FreshserviceApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ??
          `Freshservice returned HTTP ${response.status}.`,
        response.status,
      );
    return {
      status: response.status,
      data: safe,
      pagination: { link: response.headers.get("link") },
      rateLimit: {
        total: response.headers.get("x-ratelimit-total"),
        remaining: response.headers.get("x-ratelimit-remaining"),
        usedCurrentRequest: response.headers.get(
          "x-ratelimit-used-currentrequest",
        ),
      },
    };
  }

  private ticket(value: unknown) {
    const item = this.record(value);
    return {
      ticketId: this.positiveInteger(item.id, "ticketId"),
      subject: this.text(item.subject, 300) || null,
      type: this.text(item.type, 100) || null,
      status: this.integer(item.status, 0, 0, 100),
      priority: this.integer(item.priority, 0, 0, 100),
      workspaceId: this.optionalId(item.workspace_id),
      groupId: this.optionalId(item.group_id),
      responderId: this.optionalId(item.responder_id),
      dueBy: this.dateTime(item.due_by),
      createdAt: this.dateTime(item.created_at),
      updatedAt: this.dateTime(item.updated_at),
    };
  }
  private domain(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.freshservice\.com\/?$/, "")
      .replace(/\/$/, "");
    if (
      !normalized ||
      normalized.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)
    )
      throw new FreshserviceApiError(
        "provider_validation_error",
        "Freshservice domain must be the account name before .freshservice.com.",
      );
    return normalized;
  }
  private positiveInteger(value: unknown, label: string) {
    if (!Number.isSafeInteger(value) || Number(value) < 1)
      throw new FreshserviceApiError(
        "provider_validation_error",
        `Freshservice ${label} must be a positive integer.`,
      );
    return Number(value);
  }
  private optionalId(value: unknown) {
    return Number.isSafeInteger(value) && Number(value) >= 1
      ? Number(value)
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
  private text(value: unknown, maximum: number) {
    return typeof value === "string" ? value.trim().slice(0, maximum) : "";
  }
  private dateTime(value: unknown) {
    const text = this.text(value, 40);
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
        throw new FreshserviceApiError(
          "policy_blocked",
          "Freshservice request is too deeply nested.",
          403,
        );
      if (Array.isArray(item)) return item.forEach((v) => walk(v, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new FreshserviceApiError(
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
      throw new FreshserviceApiError(
        "provider_validation_error",
        "Freshservice query has too many fields.",
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
    const candidate = object.description ?? object.message ?? object.error;
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
