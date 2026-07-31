import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ReclaimAiCredentials = { apiKey: string };
type ReclaimAiMethod = "GET" | "POST" | "PATCH";

const ID = "[A-Za-z0-9_-]{1,200}";
const READ_ROUTES = [
  /^\/events$/,
  /^\/tasks$/,
  /^\/scheduling-link$/,
  /^\/scheduling-link\/group$/,
  /^\/smart-habits$/,
  /^\/timeschemes$/,
  /^\/users\/current$/,
];
const MANAGE_ROUTES: ReadonlyArray<[ReclaimAiMethod, RegExp]> = [
  ["POST", /^\/interpreter\/message$/],
  ["POST", /^\/scheduling-link\/derivative$/],
  ["POST", /^\/tasks$/],
  ["PATCH", new RegExp(`^/tasks/${ID}$`)],
  ["POST", new RegExp(`^/planner/(?:start|restart|stop)/task/${ID}$`)],
  ["POST", new RegExp(`^/planner/add-time/task/${ID}$`)],
  ["POST", new RegExp(`^/planner/(?:done|unarchive)/task/${ID}$`)],
  ["POST", new RegExp(`^/planner/task/${ID}/snooze$`)],
  ["POST", new RegExp(`^/planner/(?:start|restart|stop)/habit/${ID}$`)],
  ["POST", new RegExp(`^/smart-habits/planner/${ID}/(?:start|stop)$`)],
];

export class ReclaimAiApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ReclaimAiApiAdapter {
  async health(credentials: ReclaimAiCredentials) {
    const user = await this.request(credentials, {
      method: "GET",
      path: "/users/current",
    });
    return { apiKeyVerified: true, user };
  }

  read(credentials: ReclaimAiCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 300);
    if (!this.matches(READ_ROUTES, path)) {
      throw this.validation("Reclaim.ai read endpoint is not supported.");
    }
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: ReclaimAiCredentials, input: JsonObject) {
    const method = this.required(input.method, "method", 10).toUpperCase();
    const path = this.required(input.path, "path", 300);
    if (
      !["POST", "PATCH"].includes(method) ||
      !MANAGE_ROUTES.some(
        ([allowedMethod, pattern]) =>
          allowedMethod === method && pattern.test(path),
      )
    ) {
      throw this.validation("Reclaim.ai mutation endpoint is not supported.");
    }
    return this.request(credentials, {
      method: method as ReclaimAiMethod,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  async request(
    credentials: ReclaimAiCredentials,
    input: {
      method: ReclaimAiMethod;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 10_000) {
      throw new ReclaimAiApiError(
        "credential_missing",
        "Reclaim.ai API key is required.",
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
      throw this.validation("Reclaim.ai endpoint is invalid.");
    }
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://api.app.reclaim.ai/api${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    let body: string | undefined;
    if ((input.method === "POST" || input.method === "PATCH") && input.json) {
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000) {
        throw this.validation("Reclaim.ai request exceeds 2 MB.");
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
        throw this.validation("Reclaim.ai response exceeds 5 MB.");
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
        throw new ReclaimAiApiError(
          this.code(response.status),
          this.message(data) ?? `Reclaim.ai returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof ReclaimAiApiError) throw error;
      throw new ReclaimAiApiError(
        "provider_unavailable",
        "Reclaim.ai could not be reached.",
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
      throw this.validation("Reclaim.ai query has too many fields.");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) {
        throw this.validation("Reclaim.ai query field is invalid.");
      }
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100) {
        throw this.validation("Reclaim.ai query array is too large.");
      }
      for (const valueItem of values) {
        if (valueItem == null || valueItem === "") continue;
        if (!["string", "number", "boolean"].includes(typeof valueItem)) {
          throw this.validation("Reclaim.ai query value is invalid.");
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
        throw new ReclaimAiApiError(
          "policy_blocked",
          "Reclaim.ai request is too deeply nested.",
        );
      }
      if (Array.isArray(item)) {
        if (item.length > 1000) {
          throw new ReclaimAiApiError(
            "policy_blocked",
            "Reclaim.ai request array is too large.",
          );
        }
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000) {
        throw new ReclaimAiApiError(
          "policy_blocked",
          "Reclaim.ai request object is too large.",
        );
      }
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        ) {
          throw new ReclaimAiApiError(
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
    return new ReclaimAiApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw this.validation(`${name} is required.`);
    }
    return value.trim();
  }
}
