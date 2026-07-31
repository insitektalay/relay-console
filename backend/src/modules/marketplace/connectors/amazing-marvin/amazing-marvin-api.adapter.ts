import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type AmazingMarvinCredentials = {
  apiToken: string;
  fullAccessToken: string;
};

const READ_ENDPOINTS = new Set([
  "/doc",
  "/trackedItem",
  "/children",
  "/todayItems",
  "/dueItems",
  "/todayTimeBlocks",
  "/categories",
  "/labels",
  "/tracks",
  "/times",
  "/kudos",
  "/me",
  "/reminders",
  "/goals",
  "/habit",
  "/habits",
]);

const MANAGE_ENDPOINTS = new Set([
  "/addTask",
  "/markDone",
  "/addProject",
  "/addEvent",
  "/doc/update",
  "/doc/create",
  "/doc/delete",
  "/track",
  "/time",
  "/claimRewardPoints",
  "/unclaimRewardPoints",
  "/spendRewardPoints",
  "/resetRewardPoints",
  "/reminder/set",
  "/reminder/delete",
  "/reminder/deleteAll",
  "/updateHabit",
]);

export class AmazingMarvinApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AmazingMarvinApiAdapter {
  async health(credentials: AmazingMarvinCredentials) {
    const limited = await this.request(credentials, {
      method: "POST",
      path: "/test",
    });
    if (limited !== "OK") {
      throw this.validation("Amazing Marvin did not accept the API token.");
    }
    const full = await this.request(credentials, {
      method: "GET",
      path: "/doc",
      query: { id: "strategySettings.labelSettings.groups" },
    });
    return { limitedTokenVerified: true, fullAccessVerified: true, full };
  }

  read(credentials: AmazingMarvinCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 100);
    if (!READ_ENDPOINTS.has(path)) {
      throw this.validation("Amazing Marvin read endpoint is not documented.");
    }
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: AmazingMarvinCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 100);
    if (!MANAGE_ENDPOINTS.has(path)) {
      throw this.validation(
        "Amazing Marvin manage endpoint is not documented.",
      );
    }
    return this.request(credentials, {
      method: "POST",
      path,
      query: this.object(input.query),
      json: this.object(input.json),
      autoComplete:
        typeof input.autoComplete === "boolean"
          ? input.autoComplete
          : undefined,
    });
  }

  async request(
    credentials: AmazingMarvinCredentials,
    input: {
      method: "GET" | "POST";
      path: string;
      query?: JsonObject;
      json?: JsonObject;
      autoComplete?: boolean;
    },
  ) {
    if (
      !credentials.apiToken?.trim() ||
      !credentials.fullAccessToken?.trim() ||
      credentials.apiToken.length > 10_000 ||
      credentials.fullAccessToken.length > 10_000
    ) {
      throw new AmazingMarvinApiError(
        "credential_missing",
        "Amazing Marvin API token and full-access token are required.",
        401,
      );
    }
    if (
      !/^\/[A-Za-z][A-Za-z/]*$/.test(input.path) ||
      (!READ_ENDPOINTS.has(input.path) &&
        !MANAGE_ENDPOINTS.has(input.path) &&
        input.path !== "/test")
    ) {
      throw this.validation("Amazing Marvin endpoint is invalid.");
    }
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://serv.amazingmarvin.com/api${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const fullAccess =
      input.path === "/doc" ||
      input.path.startsWith("/doc/") ||
      (input.path === "/habits" && input.query?.raw === 1);
    const headers: Record<string, string> = {
      Accept: "application/json, text/plain",
      "Content-Type": "application/json",
      [fullAccess ? "X-Full-Access-Token" : "X-API-Token"]: fullAccess
        ? credentials.fullAccessToken.trim()
        : credentials.apiToken.trim(),
      ...(input.autoComplete === undefined
        ? {}
        : { "X-Auto-Complete": String(input.autoComplete) }),
    };
    let body: string | undefined;
    if (input.method === "POST" && input.json) {
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000) {
        throw this.validation("Amazing Marvin request exceeds 2 MB.");
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
        throw this.validation("Amazing Marvin response exceeds 5 MB.");
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
        throw new AmazingMarvinApiError(
          this.code(response.status),
          this.message(data) ??
            `Amazing Marvin returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof AmazingMarvinApiError) throw error;
      throw new AmazingMarvinApiError(
        "provider_unavailable",
        "Amazing Marvin could not be reached.",
        502,
      );
    }
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 30) {
      throw this.validation("Amazing Marvin query has too many fields.");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) {
        throw this.validation("Amazing Marvin query field is invalid.");
      }
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100) {
        throw this.validation("Amazing Marvin query array is too large.");
      }
      for (const valueItem of values) {
        if (valueItem == null || valueItem === "") continue;
        if (!["string", "number", "boolean"].includes(typeof valueItem)) {
          throw this.validation("Amazing Marvin query value is invalid.");
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
        throw new AmazingMarvinApiError(
          "policy_blocked",
          "Amazing Marvin request is too deeply nested.",
        );
      }
      if (Array.isArray(item)) {
        if (item.length > 1000) {
          throw new AmazingMarvinApiError(
            "policy_blocked",
            "Amazing Marvin request array is too large.",
          );
        }
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000) {
        throw new AmazingMarvinApiError(
          "policy_blocked",
          "Amazing Marvin request object is too large.",
        );
      }
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        ) {
          throw new AmazingMarvinApiError(
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
    return new AmazingMarvinApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw this.validation(`${name} is required.`);
    }
    return value.trim();
  }
}
