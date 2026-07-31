import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type EDeskCredentials = { apiToken: string };

export class EDeskApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class EDeskApiAdapter {
  private readonly apiOrigin = "https://api.edesk.com";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: EDeskCredentials) {
    await this.request(credentials, { method: "GET", path: "/v1/whoami" });
    return { apiOrigin: this.apiOrigin, apiVersion: "v1" };
  }

  async listTickets(credentials: EDeskCredentials, input: { limit?: number }) {
    const limit = this.integer(input.limit, 10, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/v1/tickets",
      query: { order_by: "last_updated_at", order_direction: "desc" },
    });
    const body = this.record(result.data);
    const source = Array.isArray(result.data)
      ? result.data
      : Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.tickets)
          ? body.tickets
          : [];
    return {
      tickets: source.slice(0, limit).map((value) => this.ticket(value)),
      returnedCount: Math.min(source.length, limit),
      limit,
    };
  }

  async getTicket(credentials: EDeskCredentials, ticketId: number) {
    const id = this.positiveInteger(ticketId, "ticketId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/v1/tickets/${id}`,
    });
    return { ticket: this.ticket(result.data) };
  }

  async request(
    credentials: EDeskCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const token = credentials.apiToken.trim();
    if (!token)
      throw new EDeskApiError(
        "credential_missing",
        "eDesk API token is required.",
        401,
      );
    const method = input.method.trim().toUpperCase();
    const path = input.path.trim();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/v1\/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$/.test(path) ||
      path.includes("..") ||
      path.includes("//") ||
      /[?#@\\]/.test(path)
    )
      throw new EDeskApiError(
        "provider_validation_error",
        "eDesk method or API v1 path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(`${this.apiOrigin}${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key) ||
        !["string", "number", "boolean"].includes(typeof value)
      )
        throw new EDeskApiError(
          "provider_validation_error",
          "eDesk query must contain scalar values under valid keys.",
        );
      url.searchParams.set(key, String(value));
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new EDeskApiError(
        "provider_validation_error",
        "eDesk request body exceeds the 1 MB Relay boundary.",
      );
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
        "User-Agent": "RelayConsole-eDesk/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new EDeskApiError(
        "provider_validation_error",
        "eDesk response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new EDeskApiError(
        "provider_validation_error",
        "eDesk response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new EDeskApiError(
        "provider_validation_error",
        "eDesk returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new EDeskApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `eDesk returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private ticket(value: unknown) {
    const item = this.record(value);
    return {
      ticketId: this.positiveInteger(item.id, "ticket.id"),
      status: this.shortText(item.status),
      type: this.shortText(item.type),
      createdAt: this.dateTime(item.created_at),
      lastUpdatedAt: this.dateTime(item.last_updated_at),
    };
  }
  private positiveInteger(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0)
      throw new EDeskApiError(
        "provider_validation_error",
        `eDesk ${field} must be a positive integer.`,
      );
    return number;
  }
  private shortText(value: unknown) {
    return typeof value === "string" ? value.trim().slice(0, 80) || null : null;
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
        throw new EDeskApiError(
          "policy_blocked",
          "eDesk request is too deeply nested.",
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
          throw new EDeskApiError(
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
    const candidate = error.message ?? object.message ?? object.detail;
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
