import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT";
export type SetmoreCredentials = { refreshToken: string };

const ID = "[A-Za-z0-9_-]{1,200}";
const READ_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["GET", /^\/api\/v1\/bookingapi\/services$/],
  ["GET", /^\/api\/v1\/bookingapi\/services\/categories$/],
  ["GET", new RegExp(`^/api/v1/bookingapi/services/categories/${ID}$`)],
  ["GET", /^\/api\/v1\/bookingapi\/staffs$/],
  ["POST", /^\/api\/v1\/bookingapi\/slots$/],
  ["GET", /^\/api\/v1\/bookingapi\/customer$/],
  ["GET", /^\/api\/v1\/bookingapi\/appointments$/],
];
const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", /^\/api\/v1\/bookingapi\/customer\/create$/],
  ["POST", /^\/api\/v1\/bookingapi\/appointment\/create$/],
  ["PUT", new RegExp(`^/api/v1/bookingapi/appointments/${ID}/label$`)],
];

export class SetmoreApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SetmoreApiAdapter {
  async health(credentials: SetmoreCredentials) {
    return {
      accountVerified: true,
      services: await this.request(credentials, {
        method: "GET",
        path: "/api/v1/bookingapi/services",
      }),
    };
  }

  read(credentials: SetmoreCredentials, input: JsonObject) {
    const method = String(input.method ?? "GET").toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (!READ_ROUTES.some(([allowed, pattern]) => allowed === method && pattern.test(path)))
      throw this.validation("Setmore read endpoint is not supported.");
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  manage(credentials: SetmoreCredentials, input: JsonObject) {
    const method = this.required(input.method, "method", 10).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (!MANAGE_ROUTES.some(([allowed, pattern]) => allowed === method && pattern.test(path)))
      throw this.validation("Setmore mutation endpoint is not supported.");
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  private async accessToken(credentials: SetmoreCredentials) {
    const refreshToken = credentials.refreshToken?.trim();
    if (!refreshToken || refreshToken.length > 10_000)
      throw new SetmoreApiError("credential_missing", "Setmore refresh token is required.", 401);
    const url = new URL("https://developer.setmore.com/api/v1/o/oauth2/token");
    url.searchParams.set("refreshToken", refreshToken);
    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Setmore token response exceeds 1 MB.");
      let data: unknown;
      try {
        data = raw.byteLength ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        data = null;
      }
      if (!response.ok)
        throw new SetmoreApiError(
          response.status === 429 ? "provider_rate_limited" : "token_refresh_failed",
          this.message(data) ?? "Setmore rejected the refresh token.",
          response.status,
        );
      const object = this.object(data);
      const tokenData = this.object(object?.data);
      const token = this.object(tokenData?.token);
      const accessToken = typeof token?.access_token === "string" ? token.access_token.trim() : "";
      if (!accessToken || accessToken.length > 10_000)
        throw new SetmoreApiError("token_refresh_failed", "Setmore did not return an access token.", 502);
      return accessToken;
    } catch (error) {
      if (error instanceof SetmoreApiError) throw error;
      throw new SetmoreApiError("provider_unavailable", "Setmore token service could not be reached.", 502);
    }
  }

  private async request(
    credentials: SetmoreCredentials,
    input: { method: Method; path: string; query?: JsonObject; json?: JsonObject },
  ) {
    const permitted =
      READ_ROUTES.some(([method, pattern]) => method === input.method && pattern.test(input.path)) ||
      MANAGE_ROUTES.some(([method, pattern]) => method === input.method && pattern.test(input.path));
    if (!permitted) throw this.validation("Setmore endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const accessToken = await this.accessToken(credentials);
    const url = new URL(`https://developer.setmore.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.validation("Setmore request exceeds 2 MB.");
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
        throw this.validation("Setmore response exceeds 5 MB.");
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok)
        throw new SetmoreApiError(
          this.code(response.status),
          this.message(data) ?? `Setmore returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof SetmoreApiError) throw error;
      throw new SetmoreApiError("provider_unavailable", "Setmore could not be reached.", 502);
    }
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 20)
      throw this.validation("Setmore query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(key))
        throw this.validation("Setmore query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 50)
        throw this.validation("Setmore query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Setmore query value is invalid.");
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
      if (depth > 12) throw new SetmoreApiError("policy_blocked", "Setmore request is too deeply nested.");
      if (Array.isArray(item)) {
        if (item.length > 1000) throw new SetmoreApiError("policy_blocked", "Setmore request array is too large.");
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000) throw new SetmoreApiError("policy_blocked", "Setmore request object is too large.");
      for (const [key, child] of entries) {
        if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key))
          throw new SetmoreApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`);
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
    const object = this.object(value);
    const candidate = object?.message ?? object?.msg ?? object?.error;
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
    return new SetmoreApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
}
