import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type JsonBody = JsonObject | unknown[];
type Method = "GET" | "POST" | "PUT" | "DELETE";
export type OnePageCrmCredentials = { userId: string; apiKey: string };

const BSON_ID = "[0-9a-fA-F]{24}";
const CORE_RESOURCE =
  "(?:contacts|companies|deals|actions|notes|calls|meetings)";
const REFERENCE_RESOURCE =
  "(?:lead_sources|statuses|pipelines|relationship_types|custom_fields|company_fields|deal_fields|predefined_actions|predefined_action_groups|predefined_items|predefined_item_groups)";

const READ_ROUTES = [
  new RegExp(`^/${CORE_RESOURCE}$`),
  new RegExp(`^/${CORE_RESOURCE}/${BSON_ID}$`),
  /^\/action_stream$/,
  /^\/team_stream$/,
  /^\/users$/,
  new RegExp(`^/users/${BSON_ID}$`),
  new RegExp(`^/${REFERENCE_RESOURCE}$`),
  new RegExp(`^/${REFERENCE_RESOURCE}/${BSON_ID}$`),
  /^\/filters$/,
  new RegExp(`^/filters/${BSON_ID}$`),
  /^\/countries$/,
];

const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", /^\/(?:contacts|deals|actions|notes|calls|meetings)$/],
  ["PUT", new RegExp(`^/${CORE_RESOURCE}/${BSON_ID}$`)],
  ["DELETE", new RegExp(`^/${CORE_RESOURCE}/${BSON_ID}$`)],
  [
    "PUT",
    new RegExp(
      `^/actions/${BSON_ID}/(?:unassign|mark_as_done|undo_completion|promote|revert_promotion|swap)$`,
    ),
  ],
];

export class OnePageCrmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class OnePageCrmApiAdapter {
  async health(credentials: OnePageCrmCredentials) {
    const userId = this.validUserId(credentials.userId);
    const currentUser = await this.request(credentials, {
      method: "GET",
      path: `/users/${userId}`,
    });
    const returnedId = this.userIdFrom(currentUser);
    if (!returnedId || returnedId.toLowerCase() !== userId.toLowerCase()) {
      throw new OnePageCrmApiError(
        "policy_blocked",
        "OnePageCRM credential user binding could not be verified.",
      );
    }
    return { userVerified: true, userId, apiVersion: "v3", currentUser };
  }

  read(credentials: OnePageCrmCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 500);
    if (!this.matches(READ_ROUTES, path)) {
      throw this.validation("OnePageCRM read endpoint is not supported.");
    }
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: OnePageCrmCredentials, input: JsonObject) {
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
    ) {
      throw this.validation("OnePageCRM mutation endpoint is not supported.");
    }
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.body(input.json),
    });
  }

  private async request(
    credentials: OnePageCrmCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonBody;
    },
  ) {
    const userId = this.validUserId(credentials.userId);
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 10_000) {
      throw new OnePageCrmApiError(
        "credential_missing",
        "OnePageCRM API key is required.",
        401,
      );
    }
    const permitted =
      (input.method === "GET" && this.matches(READ_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(
        ([method, pattern]) =>
          method === input.method && pattern.test(input.path),
      );
    if (!permitted) throw this.validation("OnePageCRM endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);

    const url = new URL(`https://app.onepagecrm.com/api/v3${input.path}.json`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${userId}:${apiKey}`, "utf8").toString("base64")}`,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET" && input.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 1_000_000) {
        throw this.validation("OnePageCRM request exceeds 1 MB.");
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
        throw this.validation("OnePageCRM response exceeds 5 MB.");
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
        throw new OnePageCrmApiError(
          this.code(response.status, data),
          this.message(data) ?? `OnePageCRM returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof OnePageCrmApiError) throw error;
      throw new OnePageCrmApiError(
        "provider_unavailable",
        "OnePageCRM could not be reached.",
        502,
      );
    }
  }

  private validUserId(value: unknown) {
    const userId = this.required(value, "user ID", 100);
    if (!new RegExp(`^${BSON_ID}$`).test(userId)) {
      throw new OnePageCrmApiError(
        "credential_missing",
        "OnePageCRM user ID must be the 24-character ID from API settings.",
        401,
      );
    }
    return userId;
  }

  private userIdFrom(value: unknown) {
    const object = this.object(value);
    const data = this.object(object?.data);
    const user = this.object(data?.user);
    return typeof user?.id === "string" ? user.id : null;
  }

  private matches(patterns: RegExp[], path: string) {
    return patterns.some((pattern) => pattern.test(path));
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50) {
      throw this.validation("OnePageCRM query has too many fields.");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\].-]{1,200}$/.test(key)) {
        throw this.validation("OnePageCRM query field is invalid.");
      }
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100) {
        throw this.validation("OnePageCRM query array is too large.");
      }
      for (const child of values) {
        if (child == null) continue;
        if (!["string", "number", "boolean"].includes(typeof child)) {
          throw this.validation("OnePageCRM query value is invalid.");
        }
        const text = String(child);
        if (
          key === "per_page" &&
          (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 100)
        ) {
          throw this.validation(
            "OnePageCRM per_page must be between 1 and 100.",
          );
        }
        if (
          key === "page" &&
          (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 10_000)
        ) {
          throw this.validation("OnePageCRM page must be between 1 and 10000.");
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
      throw new OnePageCrmApiError(
        "policy_blocked",
        "OnePageCRM request is too deeply nested.",
      );
    }
    if (Array.isArray(value)) {
      if (value.length > 1_000) {
        throw new OnePageCrmApiError(
          "policy_blocked",
          "OnePageCRM request array is too large.",
        );
      }
      value.forEach((child) => this.rejectSecrets(child, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 1_000) {
      throw new OnePageCrmApiError(
        "policy_blocked",
        "OnePageCRM request object is too large.",
      );
    }
    for (const [key, child] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      ) {
        throw new OnePageCrmApiError(
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
          /(token|secret|authorization|password|cookie|credential|api.?key|auth.?key)/i.test(
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
    const candidate =
      object?.error_message ?? object?.message ?? object?.error_name;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private code(
    status: number,
    value: unknown,
  ): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 402) return "insufficient_scope";
    if (status === 403) {
      const message = this.message(value)?.toLowerCase();
      return message?.includes("rate limit")
        ? "provider_rate_limited"
        : "insufficient_scope";
    }
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new OnePageCrmApiError("provider_validation_error", message);
  }

  private required(value: unknown, label: string, maxLength: number) {
    if (typeof value !== "string" || !value || value.length > maxLength) {
      throw this.validation(`OnePageCRM ${label} is invalid.`);
    }
    return value;
  }
}
