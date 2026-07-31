import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type AcquireCredentials = { accountId: string; apiKey: string };

export class AcquireApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class AcquireApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: AcquireCredentials) {
    await this.listCases(credentials, { limit: 1 });
    return {
      apiOrigin: `https://${this.accountId(credentials.accountId)}.acquire.io`,
      apiVersion: "v1",
    };
  }

  async listCases(credentials: AcquireCredentials, input: { limit?: number }) {
    const limit = this.integer(input.limit, 10, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/api/v1/crm/objects/case",
      query: { limit },
    });
    const envelope = this.record(result.data);
    const page = this.record(envelope.data);
    const source = Array.isArray(page.data) ? page.data : [];
    return {
      cases: source.slice(0, limit).map((value) => this.caseSummary(value)),
      hasMore:
        this.integer(page.count, source.length, 0, Number.MAX_SAFE_INTEGER) >
        source.length,
      limit,
    };
  }

  async getCase(credentials: AcquireCredentials, caseId: number) {
    const id = this.positiveInteger(caseId, "caseId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/api/v1/crm/objects/case/${id}`,
    });
    return { case: this.caseSummary(this.record(result.data).data) };
  }

  async request(
    credentials: AcquireCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const accountId = this.accountId(credentials.accountId);
    const apiKey = credentials.apiKey.trim();
    if (!apiKey)
      throw new AcquireApiError(
        "credential_missing",
        "Acquire API key is required.",
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
      throw new AcquireApiError(
        "provider_validation_error",
        "Acquire method or API v1 path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const url = new URL(`https://${accountId}.acquire.io${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(key) ||
        !["string", "number", "boolean"].includes(typeof value)
      )
        throw new AcquireApiError(
          "provider_validation_error",
          "Acquire query must contain scalar values under valid keys.",
        );
      url.searchParams.set(key, String(value));
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new AcquireApiError(
        "provider_validation_error",
        "Acquire request body exceeds the 1 MB Relay boundary.",
      );
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "RelayConsole-Acquire/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new AcquireApiError(
        "provider_validation_error",
        "Acquire response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new AcquireApiError(
        "provider_validation_error",
        "Acquire response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new AcquireApiError(
        "provider_validation_error",
        "Acquire returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new AcquireApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ?? `Acquire returned HTTP ${response.status}.`,
        response.status,
      );
    return { status: response.status, data: safe };
  }

  private caseSummary(value: unknown) {
    const item = this.record(value);
    return {
      caseId: this.positiveInteger(item.id, "case.id"),
      threadId: this.optionalId(item.threadId),
      channel: this.shortText(item.channel),
      status: this.shortText(item.status),
      closingState: this.shortText(item.closingState),
      queueId: this.optionalId(item.queueId),
      waitTimeSeconds: this.integer(
        item.waitTime,
        0,
        0,
        Number.MAX_SAFE_INTEGER,
      ),
      createdAt: this.dateTime(item.dateCreated),
      updatedAt: this.dateTime(item.dateUpdated),
      queuedAt: this.dateTime(item.dateQueue),
      activeAt: this.dateTime(item.dateActive),
      closedAt: this.dateTime(item.dateClosed),
    };
  }
  private accountId(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.acquire\.io\/?$/, "")
      .replace(/\/$/, "");
    if (
      !normalized ||
      normalized.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)
    )
      throw new AcquireApiError(
        "provider_validation_error",
        "Acquire accountId must be the hostname label before .acquire.io.",
      );
    return normalized;
  }
  private positiveInteger(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0)
      throw new AcquireApiError(
        "provider_validation_error",
        `Acquire ${field} must be a positive integer.`,
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
        throw new AcquireApiError(
          "policy_blocked",
          "Acquire request is too deeply nested.",
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
          throw new AcquireApiError(
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
    const candidate = object.message ?? object.error ?? object.detail;
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
