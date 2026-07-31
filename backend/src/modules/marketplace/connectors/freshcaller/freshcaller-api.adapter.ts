import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type FreshcallerCredentials = { domain: string; apiKey: string };

export class FreshcallerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class FreshcallerApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: FreshcallerCredentials) {
    await this.request(credentials, {
      method: "GET",
      path: "/api/v1/call_metrics",
      query: { page: 1, per_page: 1 },
    });
    return { domain: this.domain(credentials.domain) };
  }

  async listCallMetrics(
    credentials: FreshcallerCredentials,
    input: { limit?: number },
  ) {
    const limit = this.integer(input.limit, 25, 1, 25);
    const result = await this.request(credentials, {
      method: "GET",
      path: "/api/v1/call_metrics",
      query: { page: 1, per_page: limit },
    });
    const body = this.record(result.data);
    const values = Array.isArray(result.data)
      ? result.data
      : Array.isArray(body.call_metrics)
        ? body.call_metrics
        : [];
    return {
      metrics: values.slice(0, limit).map((value) => this.metric(value)),
      page: 1,
      limit,
    };
  }

  async getCallMetrics(credentials: FreshcallerCredentials, callId: number) {
    const id = this.positiveInteger(callId, "callId");
    const result = await this.request(credentials, {
      method: "GET",
      path: `/api/v1/calls/${id}/call_metrics`,
    });
    const body = this.record(result.data);
    return { metric: this.metric(body.call_metric ?? result.data) };
  }

  async request(
    credentials: FreshcallerCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const domain = this.domain(credentials.domain);
    if (!credentials.apiKey.trim())
      throw new FreshcallerApiError(
        "credential_missing",
        "Freshcaller API key is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/api\/v1\/[A-Za-z0-9_./-]+$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw new FreshcallerApiError(
        "provider_validation_error",
        "Freshcaller method or API v1 path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw new FreshcallerApiError(
        "provider_validation_error",
        "Freshcaller request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(`https://${domain}.freshcaller.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const response = await this.requester(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Auth": credentials.apiKey,
        "User-Agent": "RelayConsole-Freshcaller/1.0",
      },
      body,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new FreshcallerApiError(
        "provider_validation_error",
        "Freshcaller response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new FreshcallerApiError(
        "provider_validation_error",
        "Freshcaller response exceeds the 2 MB Relay boundary.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      throw new FreshcallerApiError(
        "provider_validation_error",
        "Freshcaller returned invalid JSON.",
        response.status,
      );
    }
    const safe = this.redact(parsed);
    if (!response.ok)
      throw new FreshcallerApiError(
        this.safeCode(response.status),
        this.errorMessage(safe) ??
          `Freshcaller returned HTTP ${response.status}.`,
        response.status,
      );
    return {
      status: response.status,
      data: safe,
      rateLimit: {
        total: response.headers.get("x-ratelimit-total"),
        remaining: response.headers.get("x-ratelimit-remaining"),
        usedCurrentRequest: response.headers.get(
          "x-ratelimit-used-currentrequest",
        ),
      },
    };
  }

  private metric(value: unknown) {
    const item = this.record(value);
    return {
      metricId: this.positiveInteger(item.id, "metricId"),
      callId: this.positiveInteger(item.call_id, "callId"),
      ivrSeconds: this.optionalNumber(item.ivr_time),
      holdSeconds: this.optionalNumber(item.hold_duration),
      workSeconds: this.optionalNumber(item.call_work_time),
      ringingSeconds: this.optionalNumber(item.total_ringing_time),
      talkSeconds: this.optionalNumber(item.talk_time),
      answeringSpeedSeconds: this.optionalNumber(item.answering_speed),
      recordingSeconds: this.optionalNumber(item.recording_duration),
      billSeconds: this.optionalNumber(item.bill_duration),
      cost: this.optionalNumber(item.cost),
      costUnit: this.optionalText(item.cost_unit, 20),
      createdAt: this.dateTime(item.created_time),
      updatedAt: this.dateTime(item.updated_time),
    };
  }

  private domain(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.freshcaller\.com\/?$/, "")
      .replace(/\/$/, "");
    if (
      !normalized ||
      normalized.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)
    )
      throw new FreshcallerApiError(
        "provider_validation_error",
        "Freshcaller domain must be the account name before .freshcaller.com.",
      );
    return normalized;
  }
  private positiveInteger(value: unknown, label: string) {
    if (!Number.isSafeInteger(value) || Number(value) < 1)
      throw new FreshcallerApiError(
        "provider_validation_error",
        `Freshcaller ${label} must be a positive integer.`,
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
        throw new FreshcallerApiError(
          "policy_blocked",
          "Freshcaller request is too deeply nested.",
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
          throw new FreshcallerApiError(
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
      throw new FreshcallerApiError(
        "provider_validation_error",
        "Freshcaller query has too many fields.",
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
