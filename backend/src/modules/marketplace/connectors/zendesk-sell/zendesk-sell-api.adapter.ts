import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type JsonBody = JsonObject | unknown[];
type Method = "GET" | "POST" | "PUT" | "DELETE";
export type ZendeskSellCredentials = { accessToken: string };

const NUMERIC_ID = "[0-9]{1,20}";
const CORE_COLLECTION =
  "(?:contacts|leads|deals|tasks|notes|calls|visits|products|orders|documents|line_items|pipelines|stages|sources|lead_sources|deal_sources|loss_reasons|unqualified_reasons|deal_unqualified_reasons|lead_unqualified_reasons|call_outcomes|visit_outcomes|users|custom_fields|tags|sequences|sequence_enrollments)";

const READ_ROUTES = [
  /^\/oauth2\/token\/info$/,
  /^\/v2\/account$/,
  new RegExp(`^/v2/${CORE_COLLECTION}$`),
  new RegExp(`^/v2/${CORE_COLLECTION}/${NUMERIC_ID}$`),
  new RegExp(`^/v2/(?:contacts|deals)/${NUMERIC_ID}/associated_contacts$`),
];

const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", new RegExp(`^/v2/${CORE_COLLECTION}$`)],
  ["PUT", new RegExp(`^/v2/${CORE_COLLECTION}/${NUMERIC_ID}$`)],
  ["DELETE", new RegExp(`^/v2/${CORE_COLLECTION}/${NUMERIC_ID}$`)],
  ["POST", /^\/v2\/lead_conversions$/],
  [
    "POST",
    new RegExp(`^/v2/(?:contacts|deals)/${NUMERIC_ID}/associated_contacts$`),
  ],
  [
    "DELETE",
    new RegExp(
      `^/v2/(?:contacts|deals)/${NUMERIC_ID}/associated_contacts/${NUMERIC_ID}$`,
    ),
  ],
];

export class ZendeskSellApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ZendeskSellApiAdapter {
  async health(credentials: ZendeskSellCredentials) {
    const token = await this.request(credentials, {
      method: "GET",
      path: "/oauth2/token/info",
    });
    const account = await this.request(credentials, {
      method: "GET",
      path: "/v2/account",
    });
    return { accountVerified: true, token, account };
  }

  read(credentials: ZendeskSellCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 500);
    if (!this.matches(READ_ROUTES, path))
      throw this.validation("Zendesk Sell read endpoint is not supported.");
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: ZendeskSellCredentials, input: JsonObject) {
    const method = this.requiredMethod(input.method);
    const path = this.required(input.path, "path", 500);
    if (
      !MANAGE_ROUTES.some(
        ([allowed, pattern]) => allowed === method && pattern.test(path),
      )
    )
      throw this.validation("Zendesk Sell mutation endpoint is not supported.");
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.body(input.json),
    });
  }

  private async request(
    credentials: ZendeskSellCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonBody;
    },
  ) {
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken || accessToken.length > 10_000)
      throw new ZendeskSellApiError(
        "credential_missing",
        "Zendesk Sell OAuth access token is required.",
        401,
      );
    const permitted =
      (input.method === "GET" && this.matches(READ_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(
        ([method, pattern]) =>
          method === input.method && pattern.test(input.path),
      );
    if (!permitted) throw this.validation("Zendesk Sell endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://api.getbase.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET" && input.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 1_000_000)
        throw this.validation("Zendesk Sell request exceeds 1 MB.");
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
        throw this.validation("Zendesk Sell response exceeds 5 MB.");
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok)
        throw new ZendeskSellApiError(
          this.code(response.status),
          this.message(data) ??
            `Zendesk Sell returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof ZendeskSellApiError) throw error;
      throw new ZendeskSellApiError(
        "provider_unavailable",
        "Zendesk Sell could not be reached.",
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
      throw this.validation("Zendesk Sell query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\].,-]{1,100}$/.test(key))
        throw this.validation("Zendesk Sell query field is invalid.");
      if (/^(?:includes|ids)$/i.test(key) && String(item).length > 2_000)
        throw this.validation("Zendesk Sell query field is too large.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.validation("Zendesk Sell query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Zendesk Sell query value is invalid.");
        const text = String(child);
        if (key === "per_page" && (!/^\d+$/.test(text) || Number(text) > 100))
          throw this.validation("Zendesk Sell page size must be at most 100.");
        if (key === "page" && (!/^\d+$/.test(text) || Number(text) > 1_000))
          throw this.validation("Zendesk Sell page must be at most 1000.");
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
      throw new ZendeskSellApiError(
        "policy_blocked",
        "Zendesk Sell request is too deeply nested.",
      );
    if (Array.isArray(value)) {
      if (value.length > 1000)
        throw this.validation("Zendesk Sell array is too large.");
      value.forEach((entry) => this.rejectSecrets(entry, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /token|secret|password|credential|authorization|api[-_]?key/i.test(key)
      )
        throw new ZendeskSellApiError(
          "policy_blocked",
          "Zendesk Sell request must not include credentials.",
        );
      this.rejectSecrets(child, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (value == null || depth > 12) return value;
    if (Array.isArray(value))
      return value.slice(0, 1000).map((entry) => this.redact(entry, depth + 1));
    if (typeof value !== "object") return value;
    const output: JsonObject = {};
    for (const [key, child] of Object.entries(value as JsonObject).slice(
      0,
      1000,
    )) {
      output[key] =
        /token|secret|password|credential|authorization|api[-_]?key/i.test(key)
          ? "[redacted]"
          : this.redact(child, depth + 1);
    }
    return output;
  }

  private required(value: unknown, field: string, maxLength: number) {
    if (typeof value !== "string" || !value.trim())
      throw this.validation(`Zendesk Sell ${field} is required.`);
    const trimmed = value.trim();
    if (trimmed.length > maxLength)
      throw this.validation(`Zendesk Sell ${field} is too long.`);
    if (!trimmed.startsWith("/") || trimmed.includes("://"))
      throw this.validation(`Zendesk Sell ${field} must be a relative path.`);
    return trimmed;
  }

  private requiredMethod(value: unknown): Method {
    if (typeof value !== "string" || !value.trim())
      throw this.validation("Zendesk Sell method is required.");
    const method = value.trim().toUpperCase();
    if (!["GET", "POST", "PUT", "DELETE"].includes(method))
      throw this.validation("Zendesk Sell method is not supported.");
    return method as Method;
  }

  private message(value: unknown): string | null {
    if (!value || typeof value !== "object") return null;
    const record = value as JsonObject;
    const error = record.error ?? record.message ?? record.description;
    return typeof error === "string" && error.trim()
      ? error.slice(0, 500)
      : null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 408 || status === 409 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new ZendeskSellApiError("provider_validation_error", message, 400);
  }
}
