import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type JsonBody = JsonObject | unknown[];
type Method = "GET" | "POST" | "PUT" | "DELETE";
export type SalesflareCredentials = { apiKey: string };

const NUMERIC_ID = "[0-9]{1,20}";
const SAFE_ID = "[A-Za-z0-9_-]{1,200}";
const CUSTOM_CLASS = "(?:accounts|contacts|opportunities)";

const READ_ROUTES = [
  /^\/tasks$/,
  /^\/accounts$/,
  new RegExp(`^/accounts/${NUMERIC_ID}$`),
  new RegExp(`^/accounts/${NUMERIC_ID}/(?:feed|messages)$`),
  /^\/contacts$/,
  new RegExp(`^/contacts/${NUMERIC_ID}$`),
  /^\/opportunities$/,
  new RegExp(`^/opportunities/${NUMERIC_ID}$`),
  /^\/workflows$/,
  new RegExp(`^/workflows/${NUMERIC_ID}$`),
  /^\/campaigns\/mergefields$/,
  new RegExp(`^/conferences/${SAFE_ID}$`),
  new RegExp(`^/meetings/${NUMERIC_ID}$`),
  /^\/me$/,
  /^\/me\/contacts$/,
  /^\/users$/,
  new RegExp(`^/users/${NUMERIC_ID}$`),
  /^\/groups$/,
  new RegExp(`^/groups/${NUMERIC_ID}$`),
  /^\/currencies$/,
  /^\/pipelines$/,
  /^\/stages$/,
  new RegExp(`^/stages/${NUMERIC_ID}$`),
  /^\/customfields\/types$/,
  new RegExp(`^/customfields/${CUSTOM_CLASS}$`),
  new RegExp(`^/customfields/${CUSTOM_CLASS}/${NUMERIC_ID}$`),
  new RegExp(`^/customfields/${CUSTOM_CLASS}/${SAFE_ID}/options$`),
  /^\/datasources\/email$/,
  /^\/tags$/,
  new RegExp(`^/tags/${NUMERIC_ID}$`),
  new RegExp(`^/tags/${NUMERIC_ID}/usage$`),
  new RegExp(`^/filterfields/${SAFE_ID}$`),
  /^\/persons$/,
  /^\/settings\/ai$/,
];

const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", /^\/tasks$/],
  ["PUT", new RegExp(`^/tasks/${NUMERIC_ID}$`)],
  ["DELETE", new RegExp(`^/tasks/${NUMERIC_ID}$`)],
  ["POST", /^\/accounts$/],
  ["PUT", new RegExp(`^/accounts/${NUMERIC_ID}$`)],
  ["DELETE", new RegExp(`^/accounts/${NUMERIC_ID}$`)],
  ["POST", new RegExp(`^/accounts/${NUMERIC_ID}/users$`)],
  ["POST", /^\/contacts$/],
  ["PUT", new RegExp(`^/contacts/${NUMERIC_ID}$`)],
  ["DELETE", new RegExp(`^/contacts/${NUMERIC_ID}$`)],
  ["POST", /^\/opportunities$/],
  ["PUT", new RegExp(`^/opportunities/${NUMERIC_ID}$`)],
  ["DELETE", new RegExp(`^/opportunities/${NUMERIC_ID}$`)],
  ["POST", /^\/workflows$/],
  ["PUT", new RegExp(`^/workflows/${NUMERIC_ID}$`)],
  ["PUT", new RegExp(`^/workflows/${NUMERIC_ID}/audience/${NUMERIC_ID}$`)],
  ["POST", /^\/calls$/],
  ["PUT", new RegExp(`^/calls/${NUMERIC_ID}$`)],
  ["POST", /^\/meetings$/],
  ["PUT", new RegExp(`^/meetings/${NUMERIC_ID}$`)],
  ["DELETE", new RegExp(`^/meetings/${NUMERIC_ID}$`)],
  ["POST", /^\/messages$/],
  ["PUT", new RegExp(`^/messages/${NUMERIC_ID}$`)],
  ["DELETE", new RegExp(`^/messages/${NUMERIC_ID}$`)],
  ["POST", new RegExp(`^/customfields/${CUSTOM_CLASS}$`)],
  ["PUT", new RegExp(`^/customfields/${CUSTOM_CLASS}/${NUMERIC_ID}$`)],
  ["DELETE", new RegExp(`^/customfields/${CUSTOM_CLASS}/${NUMERIC_ID}$`)],
  ["PUT", new RegExp(`^/datasources/email/${NUMERIC_ID}$`)],
  ["POST", /^\/tags$/],
  ["PUT", new RegExp(`^/tags/${NUMERIC_ID}$`)],
  ["DELETE", new RegExp(`^/tags/${NUMERIC_ID}$`)],
  ["PUT", /^\/settings\/ai$/],
];

export class SalesflareApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SalesflareApiAdapter {
  async health(credentials: SalesflareCredentials) {
    const currentUser = await this.request(credentials, {
      method: "GET",
      path: "/me",
    });
    return { accountVerified: true, currentUser };
  }

  read(credentials: SalesflareCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 500);
    if (!this.matches(READ_ROUTES, path))
      throw this.validation("Salesflare read endpoint is not supported.");
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: SalesflareCredentials, input: JsonObject) {
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
      throw this.validation("Salesflare mutation endpoint is not supported.");
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.body(input.json),
    });
  }

  private async request(
    credentials: SalesflareCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonBody;
    },
  ) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 10_000)
      throw new SalesflareApiError(
        "credential_missing",
        "Salesflare API key is required.",
        401,
      );
    const permitted =
      (input.method === "GET" && this.matches(READ_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(
        ([method, pattern]) =>
          method === input.method && pattern.test(input.path),
      );
    if (!permitted) throw this.validation("Salesflare endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://api.salesflare.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET" && input.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 1_000_000)
        throw this.validation("Salesflare request exceeds 1 MB.");
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
        throw this.validation("Salesflare response exceeds 5 MB.");
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok)
        throw new SalesflareApiError(
          this.code(response.status),
          this.message(data) ?? `Salesflare returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof SalesflareApiError) throw error;
      throw new SalesflareApiError(
        "provider_unavailable",
        "Salesflare could not be reached.",
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
      throw this.validation("Salesflare query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\].-]{1,100}$/.test(key))
        throw this.validation("Salesflare query field is invalid.");
      if (key === "export")
        throw new SalesflareApiError(
          "policy_blocked",
          "Salesflare export mode is not available to agents.",
        );
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.validation("Salesflare query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Salesflare query value is invalid.");
        const text = String(child);
        if (key === "limit" && (!/^\d+$/.test(text) || Number(text) > 100))
          throw this.validation("Salesflare list limit must be at most 100.");
        if (key === "offset" && (!/^\d+$/.test(text) || Number(text) > 10_000))
          throw this.validation("Salesflare offset must be at most 10000.");
        params.append(key, text.slice(0, 10_000));
      }
    }
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private body(value: unknown): JsonBody | undefined {
    return value && typeof value === "object" ? (value as JsonBody) : undefined;
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (value == null) return;
    if (depth > 12)
      throw new SalesflareApiError(
        "policy_blocked",
        "Salesflare request is too deeply nested.",
      );
    if (Array.isArray(value)) {
      if (value.length > 1000)
        throw new SalesflareApiError(
          "policy_blocked",
          "Salesflare request array is too large.",
        );
      value.forEach((child) => this.rejectSecrets(child, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 1000)
      throw new SalesflareApiError(
        "policy_blocked",
        "Salesflare request object is too large.",
      );
    for (const [key, child] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new SalesflareApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      this.rejectSecrets(child, depth + 1);
    }
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
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
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
    return new SalesflareApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
}
