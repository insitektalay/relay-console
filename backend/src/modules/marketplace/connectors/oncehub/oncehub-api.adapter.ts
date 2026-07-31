import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PATCH" | "DELETE";
export type OnceHubCredentials = { apiKey: string };

const ID = "[A-Za-z0-9_-]{1,200}";
const READ_ROUTES = [
  /^\/test$/,
  /^\/bookings$/,
  new RegExp(`^/bookings/${ID}$`),
  /^\/booking-calendars$/,
  new RegExp(`^/booking-calendars/${ID}$`),
  new RegExp(`^/booking-calendars/${ID}/time-slots$`),
  /^\/booking-pages$/,
  new RegExp(`^/booking-pages/${ID}$`),
  /^\/event-types$/,
  new RegExp(`^/event-types/${ID}$`),
  /^\/master-pages$/,
  new RegExp(`^/master-pages/${ID}$`),
  /^\/notifications\/sms$/,
  /^\/users$/,
  new RegExp(`^/users/${ID}$`),
  new RegExp(`^/users/${ID}/scheduling-availability$`),
  /^\/teams$/,
  new RegExp(`^/teams/${ID}$`),
  /^\/contacts$/,
  new RegExp(`^/contacts/${ID}$`),
  /^\/webhooks$/,
  new RegExp(`^/webhooks/${ID}$`),
];
const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", new RegExp(`^/bookings/${ID}/(cancel|request-reschedule|reassign|no-show)$`)],
  ["POST", new RegExp(`^/booking-calendars/${ID}/(schedule|one-time-links)$`)],
  ["POST", new RegExp(`^/master-pages/${ID}/one-time-links$`)],
  ["POST", /^\/users$/],
  ["PATCH", new RegExp(`^/users/${ID}$`)],
  ["DELETE", new RegExp(`^/users/${ID}$`)],
  ["PATCH", new RegExp(`^/users/${ID}/scheduling-availability$`)],
  ["POST", /^\/contacts$/],
  ["PATCH", new RegExp(`^/contacts/${ID}$`)],
  ["DELETE", new RegExp(`^/contacts/${ID}$`)],
  ["POST", /^\/webhooks$/],
  ["DELETE", new RegExp(`^/webhooks/${ID}$`)],
];

export class OnceHubApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class OnceHubApiAdapter {
  async health(credentials: OnceHubCredentials) {
    await this.request(credentials, { method: "GET", path: "/test" });
    return { accountVerified: true };
  }

  read(credentials: OnceHubCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 500);
    if (!this.matches(READ_ROUTES, path))
      throw this.validation("OnceHub read endpoint is not supported.");
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: OnceHubCredentials, input: JsonObject) {
    const method = this.required(input.method, "method", 10).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (!MANAGE_ROUTES.some(([allowed, pattern]) => allowed === method && pattern.test(path)))
      throw this.validation("OnceHub mutation endpoint is not supported.");
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  private async request(
    credentials: OnceHubCredentials,
    input: { method: Method; path: string; query?: JsonObject; json?: JsonObject },
  ) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 10_000)
      throw new OnceHubApiError("credential_missing", "OnceHub API key is required.", 401);
    const permitted =
      (input.method === "GET" && this.matches(READ_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(([method, pattern]) => method === input.method && pattern.test(input.path));
    if (!permitted) throw this.validation("OnceHub endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://api.oncehub.com/v2${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "API-Key": apiKey,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET" && input.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.validation("OnceHub request exceeds 2 MB.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: input.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000)
        throw this.validation("OnceHub response exceeds 5 MB.");
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok)
        throw new OnceHubApiError(
          this.code(response.status),
          this.message(data) ?? `OnceHub returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof OnceHubApiError) throw error;
      throw new OnceHubApiError("provider_unavailable", "OnceHub could not be reached.", 502);
    }
  }

  private matches(patterns: RegExp[], path: string) {
    return patterns.some((pattern) => pattern.test(path));
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 30)
      throw this.validation("OnceHub query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\].-]{1,100}$/.test(key))
        throw this.validation("OnceHub query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.validation("OnceHub query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("OnceHub query value is invalid.");
        params.append(key, String(child).slice(0, 10_000));
      }
    }
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private rejectSecrets(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12) throw new OnceHubApiError("policy_blocked", "OnceHub request is too deeply nested.");
      if (Array.isArray(item)) {
        if (item.length > 1000) throw new OnceHubApiError("policy_blocked", "OnceHub request array is too large.");
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000) throw new OnceHubApiError("policy_blocked", "OnceHub request object is too large.");
      for (const [key, child] of entries) {
        if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key))
          throw new OnceHubApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`);
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private message(value: unknown) {
    if (typeof value === "string") return value.slice(0, 500);
    const object = value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
    const candidate = object?.message ?? object?.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new OnceHubApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
}
