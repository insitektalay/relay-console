import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type MotionCredentials = { apiKey: string };
type MotionMethod = "GET" | "POST" | "PATCH" | "DELETE";

const ID = "[A-Za-z0-9_-]{1,200}";
const READ_ROUTES = [
  /^\/v1\/comments$/,
  /^\/v1\/projects$/,
  new RegExp(`^/v1/projects/${ID}$`),
  /^\/v1\/recurring-tasks$/,
  /^\/v1\/schedules$/,
  /^\/v1\/statuses$/,
  /^\/v1\/tasks$/,
  new RegExp(`^/v1/tasks/${ID}$`),
  /^\/v1\/users$/,
  /^\/v1\/users\/me$/,
  /^\/v1\/workspaces$/,
  new RegExp(`^/beta/workspaces/${ID}/custom-fields$`),
];
const MANAGE_ROUTES: ReadonlyArray<[MotionMethod, RegExp]> = [
  ["POST", /^\/v1\/comments$/],
  ["POST", /^\/v1\/projects$/],
  ["POST", /^\/v1\/recurring-tasks$/],
  ["DELETE", new RegExp(`^/v1/recurring-tasks/${ID}$`)],
  ["POST", /^\/v1\/tasks$/],
  ["PATCH", new RegExp(`^/v1/tasks/${ID}$`)],
  ["PATCH", new RegExp(`^/v1/tasks/${ID}/move$`)],
  ["DELETE", new RegExp(`^/v1/tasks/${ID}$`)],
  ["DELETE", new RegExp(`^/v1/tasks/${ID}/assignee$`)],
  ["POST", new RegExp(`^/beta/custom-field-values/project/${ID}$`)],
  ["POST", new RegExp(`^/beta/custom-field-values/task/${ID}$`)],
  [
    "DELETE",
    new RegExp(`^/beta/custom-field-values/project/${ID}/custom-fields/${ID}$`),
  ],
  [
    "DELETE",
    new RegExp(`^/beta/custom-field-values/task/${ID}/custom-fields/${ID}$`),
  ],
  ["POST", new RegExp(`^/beta/workspaces/${ID}/custom-fields$`)],
  ["DELETE", new RegExp(`^/beta/workspaces/${ID}/custom-fields/${ID}$`)],
];

export class MotionApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MotionApiAdapter {
  async health(credentials: MotionCredentials) {
    const user = await this.request(credentials, {
      method: "GET",
      path: "/v1/users/me",
    });
    return { apiKeyVerified: true, user };
  }

  read(credentials: MotionCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 300);
    if (!this.matches(READ_ROUTES, path)) {
      throw this.validation("Motion read endpoint is not documented.");
    }
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: MotionCredentials, input: JsonObject) {
    const method = this.required(input.method, "method", 10).toUpperCase();
    const path = this.required(input.path, "path", 300);
    if (
      !["POST", "PATCH", "DELETE"].includes(method) ||
      !MANAGE_ROUTES.some(
        ([allowedMethod, pattern]) =>
          allowedMethod === method && pattern.test(path),
      )
    ) {
      throw this.validation("Motion mutation endpoint is not documented.");
    }
    return this.request(credentials, {
      method: method as MotionMethod,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  async request(
    credentials: MotionCredentials,
    input: {
      method: MotionMethod;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 10_000) {
      throw new MotionApiError(
        "credential_missing",
        "Motion API key is required.",
        401,
      );
    }
    const isRead =
      input.method === "GET" && this.matches(READ_ROUTES, input.path);
    const isManage = MANAGE_ROUTES.some(
      ([method, pattern]) =>
        method === input.method && pattern.test(input.path),
    );
    if (!isRead && !isManage) {
      throw this.validation("Motion endpoint is invalid.");
    }
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://api.usemotion.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    };
    let body: string | undefined;
    if ((input.method === "POST" || input.method === "PATCH") && input.json) {
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000) {
        throw this.validation("Motion request exceeds 2 MB.");
      }
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
      if (raw.byteLength > 5_000_000) {
        throw this.validation("Motion response exceeds 5 MB.");
      }
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok) {
        throw new MotionApiError(
          this.code(response.status),
          this.message(data) ?? `Motion returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof MotionApiError) throw error;
      throw new MotionApiError(
        "provider_unavailable",
        "Motion could not be reached.",
        502,
      );
    }
  }

  private matches(patterns: RegExp[], path: string) {
    return patterns.some((pattern) => pattern.test(path));
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 30) {
      throw this.validation("Motion query has too many fields.");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) {
        throw this.validation("Motion query field is invalid.");
      }
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100) {
        throw this.validation("Motion query array is too large.");
      }
      for (const valueItem of values) {
        if (valueItem == null || valueItem === "") continue;
        if (!["string", "number", "boolean"].includes(typeof valueItem)) {
          throw this.validation("Motion query value is invalid.");
        }
        params.append(key, String(valueItem).slice(0, 10_000));
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
      if (depth > 12) {
        throw new MotionApiError(
          "policy_blocked",
          "Motion request is too deeply nested.",
        );
      }
      if (Array.isArray(item)) {
        if (item.length > 1000) {
          throw new MotionApiError(
            "policy_blocked",
            "Motion request array is too large.",
          );
        }
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000) {
        throw new MotionApiError(
          "policy_blocked",
          "Motion request object is too large.",
        );
      }
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        ) {
          throw new MotionApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        }
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) {
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    }
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

  private code(statusCode: number): MarketplaceConnectorSafeErrorCode {
    if (statusCode === 401) return "token_expired";
    if (statusCode === 403) return "insufficient_scope";
    if (statusCode === 429) return "provider_rate_limited";
    if (statusCode >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new MotionApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw this.validation(`${name} is required.`);
    }
    return value.trim();
  }
}
