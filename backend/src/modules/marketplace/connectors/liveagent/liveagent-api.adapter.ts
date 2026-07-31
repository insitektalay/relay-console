import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type LiveAgentCredentials = { domain: string; apiKey: string };

export class LiveAgentApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class LiveAgentApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: LiveAgentCredentials) {
    await this.listTickets(credentials, { limit: 1 });
    return { domain: this.domain(credentials.domain), apiVersion: "v3" };
  }

  async listTickets(
    credentials: LiveAgentCredentials,
    input: { limit?: number },
  ) {
    const limit = this.integer(input.limit, 25, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/tickets",
      query: { _page: 1, _perPage: limit },
    });
    const body = this.record(result.data);
    const source = Array.isArray(result.data)
      ? result.data
      : Array.isArray(body.tickets)
        ? body.tickets
        : [];
    return {
      tickets: source.slice(0, limit).map((value) => this.ticket(value)),
      limit,
      hasNextPage: source.length >= limit,
    };
  }

  async getTicket(credentials: LiveAgentCredentials, ticketId: string) {
    const id = this.identifier(ticketId, "ticketId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/tickets/${encodeURIComponent(id)}`,
    });
    return { ticket: this.ticket(result.data) };
  }

  async request(
    credentials: LiveAgentCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const domain = this.domain(credentials.domain);
    const apiKey = credentials.apiKey.trim();
    if (!apiKey)
      throw new LiveAgentApiError(
        "credential_missing",
        "LiveAgent API key is required.",
        401,
      );
    const method = input.method.trim().toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method))
      throw new LiveAgentApiError(
        "provider_validation_error",
        "LiveAgent API method is invalid.",
      );
    const path = input.path.trim();
    if (
      !/^\/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$/.test(path) ||
      path.includes("..") ||
      path.includes("//") ||
      /[?#@\\]/.test(path)
    )
      throw new LiveAgentApiError(
        "provider_validation_error",
        "LiveAgent API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(`https://${domain}/api/v3${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (!/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key))
        throw new LiveAgentApiError(
          "provider_validation_error",
          "LiveAgent query key is invalid.",
        );
      if (["string", "number", "boolean"].includes(typeof value))
        url.searchParams.set(key, String(value));
      else
        throw new LiveAgentApiError(
          "provider_validation_error",
          "LiveAgent query values must be scalar.",
        );
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new LiveAgentApiError(
        "provider_validation_error",
        "LiveAgent request body exceeds the 1 MB Relay boundary.",
      );
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        apikey: apiKey,
        "User-Agent": "RelayConsole-LiveAgent/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new LiveAgentApiError(
        "provider_validation_error",
        "LiveAgent response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new LiveAgentApiError(
        "provider_validation_error",
        "LiveAgent response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new LiveAgentApiError(
        "provider_validation_error",
        "LiveAgent returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new LiveAgentApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ??
          `LiveAgent returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private ticket(value: unknown) {
    const item = this.record(value);
    return {
      ticketId: this.identifier(item.id ?? item.ticket_id, "ticketId"),
      code: this.optionalText(item.code, 128),
      status: this.optionalText(item.status, 64),
      channel: this.optionalText(item.channel ?? item.channel_type, 64),
      priority: this.optionalText(item.priority, 64),
      departmentId: this.optionalIdentifier(item.department_id),
      agentId: this.optionalIdentifier(item.agent_id ?? item.owner_id),
      createdAt: this.dateTime(item.date_created ?? item.created_at),
      updatedAt: this.dateTime(item.date_changed ?? item.updated_at),
    };
  }

  private domain(value: unknown) {
    let domain = typeof value === "string" ? value.trim().toLowerCase() : "";
    domain = domain.replace(/^https:\/\//, "").replace(/\/$/, "");
    if (
      domain.length > 253 ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
        domain,
      ) ||
      (!domain.endsWith(".ladesk.com") && !domain.endsWith(".liveagent.com"))
    )
      throw new LiveAgentApiError(
        "provider_validation_error",
        "LiveAgent account domain must be a ladesk.com or liveagent.com hostname.",
      );
    return domain;
  }
  private identifier(value: unknown, label: string) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    if (!text || text.length > 128 || !/^[A-Za-z0-9_-]+$/.test(text))
      throw new LiveAgentApiError(
        "provider_validation_error",
        `LiveAgent ${label} is invalid.`,
      );
    return text;
  }
  private optionalIdentifier(value: unknown) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    return text && text.length <= 128 && /^[A-Za-z0-9_-]+$/.test(text)
      ? text
      : null;
  }
  private optionalText(value: unknown, maximum: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maximum)
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
        throw new LiveAgentApiError(
          "policy_blocked",
          "LiveAgent request is too deeply nested.",
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
          throw new LiveAgentApiError(
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
    const candidate = error.message ?? object.message ?? object.error;
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
