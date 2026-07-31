import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type GladlyCredentials = {
  organization: string;
  agentEmail: string;
  apiToken: string;
};

export class GladlyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GladlyApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: GladlyCredentials) {
    await this.listBusinessHours(credentials, { limit: 1 });
    return {
      apiOrigin: `https://${this.organization(credentials.organization)}.gladly.com`,
      apiVersion: "v1",
    };
  }

  async listBusinessHours(
    credentials: GladlyCredentials,
    input: { limit?: number },
  ) {
    const limit = this.integer(input.limit, 10, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/api/v1/business-hours",
    });
    const source = Array.isArray(result.data) ? result.data : [];
    return {
      businessHours: source
        .slice(0, limit)
        .map((value) => this.businessHoursProjection(value)),
      truncated: source.length > limit,
      limit,
    };
  }

  async getBusinessHours(
    credentials: GladlyCredentials,
    businessHoursId: string,
  ) {
    const id = this.id(businessHoursId, "businessHoursId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/api/v1/business-hours/${id}`,
    });
    return { businessHours: this.businessHoursProjection(result.data) };
  }

  async request(
    credentials: GladlyCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const organization = this.organization(credentials.organization);
    const email = credentials.agentEmail.trim().toLowerCase();
    const token = credentials.apiToken.trim();
    if (!email || !/^[^\s:@]+@[^\s:@]+\.[^\s:@]+$/.test(email))
      throw new GladlyApiError(
        "credential_missing",
        "Gladly API-user agent email is required.",
        401,
      );
    if (!token)
      throw new GladlyApiError(
        "credential_missing",
        "Gladly API token is required.",
        401,
      );
    const method = input.method.trim().toUpperCase();
    const path = input.path.trim();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/api\/v1\/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$/.test(path) ||
      path.includes("..") ||
      path.includes("//") ||
      /[?#@\\]/.test(path)
    )
      throw new GladlyApiError(
        "provider_validation_error",
        "Gladly method or API v1 path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(`https://${organization}.gladly.com${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key) ||
        !["string", "number", "boolean"].includes(typeof value)
      )
        throw new GladlyApiError(
          "provider_validation_error",
          "Gladly query must contain scalar values under valid keys.",
        );
      url.searchParams.set(key, String(value));
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new GladlyApiError(
        "provider_validation_error",
        "Gladly request body exceeds the 1 MB Relay boundary.",
      );
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
        "User-Agent": "RelayConsole-Gladly/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new GladlyApiError(
        "provider_validation_error",
        "Gladly response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new GladlyApiError(
        "provider_validation_error",
        "Gladly response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new GladlyApiError(
        "provider_validation_error",
        "Gladly returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new GladlyApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `Gladly returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private businessHoursProjection(value: unknown) {
    const item = this.record(value);
    const officeHours = this.record(item.officeHours);
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    return {
      businessHoursId: this.id(item.id, "businessHoursId"),
      version: this.integer(item.version, 0, 0, Number.MAX_SAFE_INTEGER),
      primary: item.primary === true,
      timezone: this.optionalText(officeHours.timezone, 100),
      configuredDayCount: days.filter(
        (day) => Array.isArray(officeHours[day]) && officeHours[day].length > 0,
      ).length,
      exceptionCount: Array.isArray(officeHours.exceptions)
        ? Math.min(officeHours.exceptions.length, 10_000)
        : 0,
      createdAt: this.dateTime(item.createdAt),
      updatedAt: this.dateTime(item.updatedAt),
    };
  }

  private organization(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.gladly\.com\/?$/, "")
      .replace(/\/$/, "");
    if (
      !normalized ||
      normalized.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)
    )
      throw new GladlyApiError(
        "provider_validation_error",
        "Gladly organization must be the tenant name before .gladly.com.",
      );
    return normalized;
  }

  private id(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 128 || !/^[A-Za-z0-9_-]+$/.test(text))
      throw new GladlyApiError(
        "provider_validation_error",
        `Gladly ${label} is invalid.`,
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
        throw new GladlyApiError(
          "policy_blocked",
          "Gladly request is too deeply nested.",
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
          throw new GladlyApiError(
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
