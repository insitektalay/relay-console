import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type FreshmarketerCredentials = { bundleUrl: string; apiKey: string };

export class FreshmarketerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class FreshmarketerApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: FreshmarketerCredentials) {
    const result = await this.listContactFilters(credentials);
    return {
      bundleUrl: this.bundleBase(credentials.bundleUrl),
      filterCount: result.filters.length,
    };
  }

  async listContactFilters(credentials: FreshmarketerCredentials) {
    const result = await this.request(credentials, {
      method: "GET",
      path: "/api/contacts/filters",
    });
    const filters = Array.isArray(this.record(result.data).filters)
      ? (this.record(result.data).filters as unknown[])
      : [];
    return {
      filters: filters.slice(0, 100).map((value) => {
        const item = this.record(value);
        return {
          filterId: this.positiveInteger(item.id, "filterId"),
          name: this.optionalText(item.name, 200),
        };
      }),
    };
  }

  async listContactMetadata(
    credentials: FreshmarketerCredentials,
    input: { viewId: number; limit?: number },
  ) {
    const viewId = this.positiveInteger(input.viewId, "viewId");
    const limit = this.integer(input.limit, 25, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: `/api/contacts/view/${viewId}`,
      query: { page: 1 },
    });
    const body = this.record(result.data);
    const contacts = Array.isArray(body.contacts) ? body.contacts : [];
    const meta = this.record(body.meta);
    return {
      contacts: contacts.slice(0, limit).map((value) => this.contact(value)),
      page: 1,
      limit,
      total: Number.isSafeInteger(meta.total) ? Number(meta.total) : null,
    };
  }

  async request(
    credentials: FreshmarketerCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const base = this.bundleBase(credentials.bundleUrl);
    if (!credentials.apiKey.trim())
      throw new FreshmarketerApiError(
        "credential_missing",
        "Freshmarketer API key is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/api\/[A-Za-z0-9_./-]+$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw new FreshmarketerApiError(
        "provider_validation_error",
        "Freshmarketer method or CRM API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new FreshmarketerApiError(
        "provider_validation_error",
        "Freshmarketer request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(`${base}${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Token token=${credentials.apiKey}`,
        "User-Agent": "RelayConsole-Freshmarketer/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new FreshmarketerApiError(
        "provider_validation_error",
        "Freshmarketer response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new FreshmarketerApiError(
        "provider_validation_error",
        "Freshmarketer response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new FreshmarketerApiError(
        "provider_validation_error",
        "Freshmarketer returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new FreshmarketerApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ??
          `Freshmarketer returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private contact(value: unknown) {
    const item = this.record(value);
    return {
      contactId: this.positiveInteger(item.id, "contactId"),
      leadScore: this.optionalNumber(item.lead_score),
      marketingStatus: this.optionalText(item.marketing_status, 100),
      subscriptionStatus: this.optionalText(item.subscription_status, 100),
      lastContactedMode: this.optionalText(item.last_contacted_mode, 100),
      lastContactedAt: this.dateTime(item.last_contacted),
      createdAt: this.dateTime(item.created_at),
      updatedAt: this.dateTime(item.updated_at),
    };
  }

  private bundleBase(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new FreshmarketerApiError(
        "provider_validation_error",
        "Freshmarketer CRM bundle URL is invalid.",
      );
    }
    const hostname = url.hostname.toLowerCase();
    const validHost =
      /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.myfreshworks\.com$/.test(hostname) ||
      /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.freshworks\.com$/.test(hostname);
    const path = url.pathname.replace(/\/$/, "");
    if (
      url.protocol !== "https:" ||
      !validHost ||
      url.port ||
      url.username ||
      url.password ||
      !/^\/crm\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(path) ||
      path.includes("/api") ||
      url.search ||
      url.hash
    )
      throw new FreshmarketerApiError(
        "provider_validation_error",
        "Freshmarketer bundle URL must be the exact HTTPS Freshworks CRM bundle base before /api.",
      );
    return `https://${hostname}${path}`;
  }

  private positiveInteger(value: unknown, label: string) {
    if (!Number.isSafeInteger(value) || Number(value) < 1)
      throw new FreshmarketerApiError(
        "provider_validation_error",
        `Freshmarketer ${label} must be a positive integer.`,
      );
    return Number(value);
  }
  private optionalNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private optionalText(value: unknown, maximum: number) {
    return typeof value === "string"
      ? value.trim().slice(0, maximum) || null
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
    const text = this.optionalText(value, 40);
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
        throw new FreshmarketerApiError(
          "policy_blocked",
          "Freshmarketer request is too deeply nested.",
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
          throw new FreshmarketerApiError(
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
      throw new FreshmarketerApiError(
        "provider_validation_error",
        "Freshmarketer query has too many fields.",
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
    const candidate = object.message ?? object.description ?? object.error;
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
