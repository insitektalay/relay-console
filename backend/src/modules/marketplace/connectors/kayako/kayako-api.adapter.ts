import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type KayakoCredentials = { domain: string; accessToken: string };

export class KayakoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class KayakoApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: KayakoCredentials) {
    await this.listCases(credentials, { limit: 1 });
    return {
      apiOrigin: `https://${this.domain(credentials.domain)}.kayako.com`,
      apiVersion: "v1",
    };
  }

  async listCases(credentials: KayakoCredentials, input: { limit?: number }) {
    const limit = this.integer(input.limit, 10, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/api/v1/cases.json",
      query: { offset: 0, limit },
    });
    const body = this.record(result.data);
    const source = Array.isArray(body.data) ? body.data : [];
    return {
      cases: source.slice(0, limit).map((value) => this.caseSummary(value)),
      hasMore:
        this.integer(
          body.total_count,
          source.length,
          0,
          Number.MAX_SAFE_INTEGER,
        ) > source.length,
      limit,
    };
  }

  async getCase(credentials: KayakoCredentials, caseId: number) {
    const id = this.positiveInteger(caseId, "caseId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/api/v1/cases/${id}.json`,
    });
    const body = this.record(result.data);
    return { case: this.caseSummary(body.data) };
  }

  async request(
    credentials: KayakoCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const domain = this.domain(credentials.domain);
    const token = credentials.accessToken.trim();
    if (!token)
      throw new KayakoApiError(
        "credential_missing",
        "Kayako OAuth access token is required.",
        401,
      );
    const method = input.method.trim().toUpperCase();
    const path = input.path.trim();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/api\/v1\/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$/.test(path) ||
      path.includes("..") ||
      path.includes("//") ||
      /[?#@\\]/.test(path)
    )
      throw new KayakoApiError(
        "provider_validation_error",
        "Kayako method or API v1 path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(`https://${domain}.kayako.com${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key) ||
        !["string", "number", "boolean"].includes(typeof value)
      )
        throw new KayakoApiError(
          "provider_validation_error",
          "Kayako query must contain scalar values under valid keys.",
        );
      url.searchParams.set(key, String(value));
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new KayakoApiError(
        "provider_validation_error",
        "Kayako request body exceeds the 1 MB Relay boundary.",
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
        "User-Agent": "RelayConsole-Kayako/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new KayakoApiError(
        "provider_validation_error",
        "Kayako response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new KayakoApiError(
        "provider_validation_error",
        "Kayako response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new KayakoApiError(
        "provider_validation_error",
        "Kayako returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new KayakoApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `Kayako returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private caseSummary(value: unknown) {
    const item = this.record(value);
    return {
      caseId: this.positiveInteger(item.id, "case.id"),
      state: this.shortText(item.state),
      statusId: this.optionalId(this.record(item.status).id),
      priorityId: this.optionalId(this.record(item.priority).id),
      typeId: this.optionalId(this.record(item.type).id),
      postCount: this.integer(item.post_count, 0, 0, Number.MAX_SAFE_INTEGER),
      hasNotes: item.has_notes === true,
      hasAttachments: item.has_attachments === true,
      isMerged: item.is_merged === true,
      createdAt: this.dateTime(item.created_at),
      updatedAt: this.dateTime(item.updated_at),
    };
  }
  private domain(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.kayako\.com\/?$/, "")
      .replace(/\/$/, "");
    if (
      !normalized ||
      normalized.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)
    )
      throw new KayakoApiError(
        "provider_validation_error",
        "Kayako domain must be the hostname label before .kayako.com.",
      );
    return normalized;
  }
  private positiveInteger(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0)
      throw new KayakoApiError(
        "provider_validation_error",
        `Kayako ${field} must be a positive integer.`,
      );
    return number;
  }
  private optionalId(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
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
        throw new KayakoApiError(
          "policy_blocked",
          "Kayako request is too deeply nested.",
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
          throw new KayakoApiError(
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
    const errors = Array.isArray(object.errors) ? object.errors : [];
    const first = this.record(errors[0]);
    const candidate = first.message ?? object.message ?? object.detail;
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
