import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type JsonBody = JsonObject | unknown[];
type Method = "GET" | "POST" | "PATCH" | "DELETE";
export type FolkCrmCredentials = { apiKey: string };

const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const FOLK_ID = `[a-z]{3}_${UUID}`;
const GROUP_ID = `grp_${UUID}`;
const SAFE_SEGMENT = "[A-Za-z0-9._~%+-]{1,1500}";

const READ_ROUTES = [
  /^\/v1\/people$/,
  new RegExp(`^/v1/people/${FOLK_ID}$`),
  /^\/v1\/companies$/,
  new RegExp(`^/v1/companies/${FOLK_ID}$`),
  /^\/v1\/groups$/,
  new RegExp(`^/v1/groups/${GROUP_ID}/custom-fields/${SAFE_SEGMENT}$`),
  new RegExp(`^/v1/groups/${GROUP_ID}/${SAFE_SEGMENT}$`),
  new RegExp(`^/v1/groups/${GROUP_ID}/${SAFE_SEGMENT}/${FOLK_ID}$`),
  /^\/v1\/users$/,
  /^\/v1\/users\/me$/,
  new RegExp(`^/v1/users/${FOLK_ID}$`),
  /^\/v1\/notes$/,
  new RegExp(`^/v1/notes/${FOLK_ID}$`),
  /^\/v1\/reminders$/,
  new RegExp(`^/v1/reminders/${FOLK_ID}$`),
  /^\/v1\/webhooks$/,
  new RegExp(`^/v1/webhooks/${FOLK_ID}$`),
];

const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", /^\/v1\/people$/],
  ["PATCH", new RegExp(`^/v1/people/${FOLK_ID}$`)],
  ["DELETE", new RegExp(`^/v1/people/${FOLK_ID}$`)],
  ["POST", /^\/v1\/companies$/],
  ["PATCH", new RegExp(`^/v1/companies/${FOLK_ID}$`)],
  ["DELETE", new RegExp(`^/v1/companies/${FOLK_ID}$`)],
  ["POST", new RegExp(`^/v1/groups/${GROUP_ID}/${SAFE_SEGMENT}$`)],
  ["PATCH", new RegExp(`^/v1/groups/${GROUP_ID}/${SAFE_SEGMENT}/${FOLK_ID}$`)],
  ["DELETE", new RegExp(`^/v1/groups/${GROUP_ID}/${SAFE_SEGMENT}/${FOLK_ID}$`)],
  ["POST", /^\/v1\/notes$/],
  ["PATCH", new RegExp(`^/v1/notes/${FOLK_ID}$`)],
  ["DELETE", new RegExp(`^/v1/notes/${FOLK_ID}$`)],
  ["POST", /^\/v1\/reminders$/],
  ["PATCH", new RegExp(`^/v1/reminders/${FOLK_ID}$`)],
  ["DELETE", new RegExp(`^/v1/reminders/${FOLK_ID}$`)],
  ["POST", /^\/v1\/interactions$/],
  ["POST", /^\/v1\/webhooks$/],
  ["PATCH", new RegExp(`^/v1/webhooks/${FOLK_ID}$`)],
  ["DELETE", new RegExp(`^/v1/webhooks/${FOLK_ID}$`)],
];

export class FolkCrmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FolkCrmApiAdapter {
  async health(credentials: FolkCrmCredentials) {
    const currentUser = await this.request(credentials, {
      method: "GET",
      path: "/v1/users/me",
    });
    return { userVerified: true, apiVersion: "2025-05-26", currentUser };
  }

  read(credentials: FolkCrmCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 2_000);
    if (!this.matches(READ_ROUTES, path)) {
      throw this.validation("folk CRM read endpoint is not supported.");
    }
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: FolkCrmCredentials, input: JsonObject) {
    const method = this.required(
      input.method,
      "method",
      10,
    ).toUpperCase() as Method;
    const path = this.required(input.path, "path", 2_000);
    if (
      !MANAGE_ROUTES.some(
        ([allowed, pattern]) => allowed === method && pattern.test(path),
      )
    ) {
      throw this.validation("folk CRM mutation endpoint is not supported.");
    }
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.body(input.json),
    });
  }

  private async request(
    credentials: FolkCrmCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonBody;
    },
  ) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 10_000) {
      throw new FolkCrmApiError(
        "credential_missing",
        "folk CRM API key is required.",
        401,
      );
    }
    const permitted =
      (input.method === "GET" && this.matches(READ_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(
        ([method, pattern]) =>
          method === input.method && pattern.test(input.path),
      );
    if (!permitted) throw this.validation("folk CRM endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://api.folk.app${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-API-Version": "2025-05-26",
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET" && input.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 1_000_000) {
        throw this.validation("folk CRM request exceeds 1 MB.");
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
        throw this.validation("folk CRM response exceeds 5 MB.");
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
        throw new FolkCrmApiError(
          this.code(response.status),
          this.message(data) ?? `folk CRM returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof FolkCrmApiError) throw error;
      throw new FolkCrmApiError(
        "provider_unavailable",
        "folk CRM could not be reached.",
        502,
      );
    }
  }

  private matches(patterns: RegExp[], path: string) {
    return patterns.some((pattern) => pattern.test(path));
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50) {
      throw this.validation("folk CRM query has too many fields.");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\].-]{1,300}$/.test(key)) {
        throw this.validation("folk CRM query field is invalid.");
      }
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100) {
        throw this.validation("folk CRM query array is too large.");
      }
      for (const child of values) {
        if (child == null) continue;
        if (!["string", "number", "boolean"].includes(typeof child)) {
          throw this.validation("folk CRM query value is invalid.");
        }
        const text = String(child);
        if (
          key === "limit" &&
          (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 100)
        ) {
          throw this.validation(
            "folk CRM list limit must be between 1 and 100.",
          );
        }
        if (key === "cursor" && text.length > 128) {
          throw this.validation(
            "folk CRM cursor must be at most 128 characters.",
          );
        }
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
    if (depth > 12) {
      throw new FolkCrmApiError(
        "policy_blocked",
        "folk CRM request is too deeply nested.",
      );
    }
    if (Array.isArray(value)) {
      if (value.length > 1_000) {
        throw new FolkCrmApiError(
          "policy_blocked",
          "folk CRM request array is too large.",
        );
      }
      value.forEach((child) => this.rejectSecrets(child, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 1_000) {
      throw new FolkCrmApiError(
        "policy_blocked",
        "folk CRM request object is too large.",
      );
    }
    for (const [key, child] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      ) {
        throw new FolkCrmApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      }
      this.rejectSecrets(child, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) {
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
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
    const object = this.object(value);
    const error = this.object(object?.error);
    const candidate = error?.message ?? object?.message ?? object?.error;
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
    return new FolkCrmApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw this.validation(`${name} is required.`);
    }
    return value.trim();
  }
}
