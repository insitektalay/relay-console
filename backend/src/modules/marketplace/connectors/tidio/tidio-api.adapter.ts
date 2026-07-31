import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type TidioCredentials = { clientId: string; clientSecret: string };

export class TidioApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class TidioApiAdapter {
  private readonly origin = "https://api.tidio.com";
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: TidioCredentials) {
    await this.request(credentials, { method: "GET", path: "/project" });
    return { apiOrigin: this.origin, apiVersion: "1" };
  }

  async listTickets(credentials: TidioCredentials) {
    const result = await this.request(credentials, {
      method: "GET",
      path: "/tickets",
    });
    const body = this.record(result.data);
    const source = Array.isArray(body.data)
      ? body.data
      : Array.isArray(body.items)
        ? body.items
        : Array.isArray(result.data)
          ? result.data
          : [];
    return {
      tickets: source.slice(0, 25).map((value) => this.ticket(value)),
      hasNextPage:
        typeof body.next_cursor === "string" ||
        typeof body.nextCursor === "string",
      limit: 25,
    };
  }

  async getTicket(credentials: TidioCredentials, ticketId: number) {
    const id = this.ticketId(ticketId);
    const result = await this.request(credentials, {
      method: "GET",
      path: `/tickets/${id}`,
    });
    const body = this.record(result.data);
    return { ticket: this.ticket(body.data ?? result.data) };
  }

  async request(
    credentials: TidioCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const clientId = credentials.clientId.trim();
    const clientSecret = credentials.clientSecret.trim();
    if (!clientId || !clientSecret)
      throw new TidioApiError(
        "credential_missing",
        "Tidio OpenAPI client ID and secret are required.",
        401,
      );
    const method = input.method.trim().toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method))
      throw new TidioApiError(
        "provider_validation_error",
        "Tidio OpenAPI method is invalid.",
      );
    const path = input.path.trim();
    if (
      !/^\/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$/.test(path) ||
      path.includes("..") ||
      path.includes("//") ||
      /[?#@\\]/.test(path)
    )
      throw new TidioApiError(
        "provider_validation_error",
        "Tidio OpenAPI path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(`${this.origin}${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key) ||
        !["string", "number", "boolean"].includes(typeof value)
      )
        throw new TidioApiError(
          "provider_validation_error",
          "Tidio query must contain scalar values under valid keys.",
        );
      url.searchParams.set(key, String(value));
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new TidioApiError(
        "provider_validation_error",
        "Tidio request body exceeds the 1 MB Relay boundary.",
      );
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json; version=1",
        ...(body ? { "Content-Type": "application/json" } : {}),
        "X-Tidio-Openapi-Client-Id": clientId,
        "X-Tidio-Openapi-Client-Secret": clientSecret,
        "User-Agent": "RelayConsole-Tidio/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new TidioApiError(
        "provider_validation_error",
        "Tidio response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new TidioApiError(
        "provider_validation_error",
        "Tidio response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new TidioApiError(
        "provider_validation_error",
        "Tidio returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new TidioApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `Tidio returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private ticket(value: unknown) {
    const item = this.record(value);
    const assigned = this.record(item.assigned);
    return {
      ticketId: this.ticketId(item.id ?? item.ticket_id),
      status: this.optionalText(item.status, 32),
      priority: this.optionalText(item.priority, 32),
      assignedOperatorId: this.optionalIdentifier(
        assigned.operator_id ?? item.assigned_operator_id,
      ),
      assignedDepartmentId: this.optionalIdentifier(
        item.assigned_department_id,
      ),
      customChannelId: this.optionalIdentifier(item.custom_channel_id),
      createdAt: this.dateTime(item.created_at),
      updatedAt: this.dateTime(item.updated_at),
    };
  }
  private ticketId(value: unknown) {
    const id =
      typeof value === "number"
        ? value
        : typeof value === "string" && /^\d+$/.test(value)
          ? Number(value)
          : NaN;
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new TidioApiError(
        "provider_validation_error",
        "Tidio ticketId is invalid.",
      );
    return id;
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
  private dateTime(value: unknown) {
    const text = typeof value === "string" ? value.trim().slice(0, 40) : "";
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
        throw new TidioApiError(
          "policy_blocked",
          "Tidio request is too deeply nested.",
          403,
        );
      if (Array.isArray(item))
        return item.forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key|client.?id)/i.test(
            key,
          )
        )
          throw new TidioApiError(
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
          /(token|secret|authorization|password|cookie|credential|api.?key|client.?id)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }
  private errorMessage(value: unknown) {
    const object = this.record(value);
    const candidate = object.message ?? object.error ?? object.reason;
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
