import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT" | "DELETE";
const ID = "[0-9]{1,20}";
const READ_ROUTES = [
  /^\/api\/v1\/me$/,
  /^\/api\/v1\/meta$/,
  /^\/api\/v1\/appointments$/,
  new RegExp(`^/api/v1/appointments/${ID}$`),
  new RegExp(`^/api/v1/appointments/${ID}/payments$`),
  /^\/api\/v1\/appointment-types$/,
  /^\/api\/v1\/appointment-addons$/,
  /^\/api\/v1\/availability\/(dates|times|classes)$/,
  /^\/api\/v1\/calendars$/,
  /^\/api\/v1\/forms$/,
  /^\/api\/v1\/clients$/,
  /^\/api\/v1\/blocks$/,
  /^\/api\/v1\/certificates$/,
  /^\/api\/v1\/certificates\/check$/,
  /^\/api\/v1\/labels$/,
  /^\/api\/v1\/products$/,
  /^\/api\/v1\/orders$/,
  new RegExp(`^/api/v1/orders/${ID}$`),
  /^\/api\/v1\/webhooks$/,
];
const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", /^\/api\/v1\/appointments$/],
  ["PUT", new RegExp(`^/api/v1/appointments/${ID}$`)],
  [
    "PUT",
    new RegExp(`^/api/v1/appointments/${ID}/(reschedule|cancel|no-show)$`),
  ],
  ["POST", /^\/api\/v1\/blocks$/],
  ["DELETE", new RegExp(`^/api/v1/blocks/${ID}$`)],
  ["PUT", /^\/api\/v1\/clients$/],
  ["POST", /^\/api\/v1\/webhooks$/],
  ["DELETE", new RegExp(`^/api/v1/webhooks/${ID}$`)],
];

export class AcuitySchedulingApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AcuitySchedulingApiAdapter {
  async health(accessToken: string) {
    return {
      accountVerified: true,
      account: await this.request(accessToken, {
        method: "GET",
        path: "/api/v1/me",
      }),
    };
  }
  read(accessToken: string, input: JsonObject) {
    const path = this.required(input.path, "path", 500);
    if (!this.matches(READ_ROUTES, path))
      throw this.validation(
        "Acuity Scheduling read endpoint is not supported.",
      );
    return this.request(accessToken, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }
  manage(accessToken: string, input: JsonObject) {
    const method = this.required(
      input.method,
      "method",
      10,
    ).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (
      !MANAGE_ROUTES.some(
        ([allowed, pattern]) => allowed === method && pattern.test(path),
      )
    )
      throw this.validation(
        "Acuity Scheduling mutation endpoint is not supported.",
      );
    return this.request(accessToken, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }
  private async request(
    accessTokenValue: string,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const accessToken = accessTokenValue?.trim();
    if (!accessToken || accessToken.length > 10_000)
      throw new AcuitySchedulingApiError(
        "credential_missing",
        "Acuity Scheduling OAuth access token is required.",
        401,
      );
    const permitted =
      (input.method === "GET" && this.matches(READ_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(
        ([method, pattern]) =>
          method === input.method && pattern.test(input.path),
      );
    if (!permitted)
      throw this.validation("Acuity Scheduling endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://acuityscheduling.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET" && input.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.validation("Acuity Scheduling request exceeds 2 MB.");
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
        throw this.validation("Acuity Scheduling response exceeds 5 MB.");
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok)
        throw new AcuitySchedulingApiError(
          this.code(response.status),
          this.message(data) ??
            `Acuity Scheduling returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof AcuitySchedulingApiError) throw error;
      throw new AcuitySchedulingApiError(
        "provider_unavailable",
        "Acuity Scheduling could not be reached.",
        502,
      );
    }
  }
  private matches(patterns: RegExp[], path: string) {
    return patterns.some((pattern) => pattern.test(path));
  }
  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 30)
      throw this.validation("Acuity Scheduling query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\]-]{1,100}$/.test(key))
        throw this.validation("Acuity Scheduling query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.validation("Acuity Scheduling query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Acuity Scheduling query value is invalid.");
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
      if (depth > 12)
        throw new AcuitySchedulingApiError(
          "policy_blocked",
          "Acuity Scheduling request is too deeply nested.",
        );
      if (Array.isArray(item)) {
        if (item.length > 1000)
          throw new AcuitySchedulingApiError(
            "policy_blocked",
            "Acuity Scheduling request array is too large.",
          );
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000)
        throw new AcuitySchedulingApiError(
          "policy_blocked",
          "Acuity Scheduling request object is too large.",
        );
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new AcuitySchedulingApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
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
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
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
    return new AcuitySchedulingApiError("provider_validation_error", message);
  }
  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
}
