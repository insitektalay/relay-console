import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type JsonBody = JsonObject | unknown[];
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type KeapMaxClassicCredentials = { accessToken: string };

const ID = "[0-9]{1,20}";
const SAFE = "[A-Za-z0-9_.-]{1,200}";
const RESOURCE =
  "(?:contacts|companies|opportunities|tasks|notes|products|orders|users|tags|appointments)";

const READ_ROUTES = [
  /^\/crm\/rest\/v1\/account\/profile$/,
  /^\/crm\/rest\/v1\/locales\/defaultOptions$/,
  new RegExp(`^/crm/rest/v1/${RESOURCE}$`),
  new RegExp(`^/crm/rest/v1/${RESOURCE}/${ID}$`),
  new RegExp(`^/crm/rest/v1/(?:contacts|companies|opportunities|tasks)/model$`),
  new RegExp(`^/crm/rest/v1/campaigns(?:/${ID})?$`),
  new RegExp(`^/crm/rest/v1/campaigns/${ID}/sequences(?:/${ID})?$`),
  new RegExp(`^/crm/rest/v1/campaigns/${ID}/sequences/${ID}/contacts$`),
  new RegExp(`^/crm/rest/v1/hooks(?:/${ID})?$`),
  new RegExp(`^/crm/rest/v1/files(?:/${ID})?$`),
];

const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", new RegExp(`^/crm/rest/v1/${RESOURCE}$`)],
  ["PUT", new RegExp(`^/crm/rest/v1/${RESOURCE}/${ID}$`)],
  ["PATCH", new RegExp(`^/crm/rest/v1/${RESOURCE}/${ID}$`)],
  ["DELETE", new RegExp(`^/crm/rest/v1/${RESOURCE}/${ID}$`)],
  [
    "POST",
    new RegExp(`^/crm/rest/v1/campaigns/${ID}/sequences/${ID}/contacts/${ID}$`),
  ],
  [
    "DELETE",
    new RegExp(`^/crm/rest/v1/campaigns/${ID}/sequences/${ID}/contacts/${ID}$`),
  ],
  ["POST", new RegExp(`^/crm/rest/v1/campaigns/goals/${SAFE}/${SAFE}$`)],
  ["POST", /^\/crm\/rest\/v1\/tags$/],
  ["POST", new RegExp(`^/crm/rest/v1/tags/${ID}/contacts$`)],
  ["DELETE", new RegExp(`^/crm/rest/v1/tags/${ID}/contacts/${ID}$`)],
];

export class KeapMaxClassicApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class KeapMaxClassicApiAdapter {
  async health(credentials: KeapMaxClassicCredentials) {
    const profile = await this.request(credentials, {
      method: "GET",
      path: "/crm/rest/v1/account/profile",
    });
    return { accountVerified: true, profile };
  }

  read(credentials: KeapMaxClassicCredentials, input: JsonObject) {
    const path = this.requiredPath(input.path);
    if (!this.matches(READ_ROUTES, path))
      throw this.validation("Keap Max Classic read endpoint is not supported.");
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: KeapMaxClassicCredentials, input: JsonObject) {
    const method = this.requiredMethod(input.method);
    const path = this.requiredPath(input.path);
    if (
      !MANAGE_ROUTES.some(
        ([allowed, pattern]) => allowed === method && pattern.test(path),
      )
    )
      throw this.validation(
        "Keap Max Classic mutation endpoint is not supported.",
      );
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.body(input.json),
    });
  }

  private async request(
    credentials: KeapMaxClassicCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonBody;
    },
  ) {
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken || accessToken.length > 10_000)
      throw new KeapMaxClassicApiError(
        "credential_missing",
        "Keap Max Classic OAuth access token is required.",
        401,
      );
    const permitted =
      (input.method === "GET" && this.matches(READ_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(
        ([method, pattern]) =>
          method === input.method && pattern.test(input.path),
      );
    if (!permitted)
      throw this.validation("Keap Max Classic endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://api.infusionsoft.com${input.path}`);
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
        throw this.validation("Keap Max Classic request exceeds 1 MB.");
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
        throw this.validation("Keap Max Classic response exceeds 5 MB.");
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok)
        throw new KeapMaxClassicApiError(
          this.code(response.status),
          this.message(data) ??
            `Keap Max Classic returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof KeapMaxClassicApiError) throw error;
      throw new KeapMaxClassicApiError(
        "provider_unavailable",
        "Keap Max Classic could not be reached.",
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
      throw this.validation("Keap Max Classic query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\].,-]{1,100}$/.test(key))
        throw this.validation("Keap Max Classic query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.validation("Keap Max Classic query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Keap Max Classic query value is invalid.");
        const text = String(child);
        if (
          /^(?:limit|page_size)$/.test(key) &&
          (!/^\d+$/.test(text) || Number(text) > 100)
        )
          throw this.validation(
            "Keap Max Classic page size must be at most 100.",
          );
        if (key === "page" && (!/^\d+$/.test(text) || Number(text) > 1000))
          throw this.validation("Keap Max Classic page must be at most 1000.");
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
      throw new KeapMaxClassicApiError(
        "policy_blocked",
        "Keap Max Classic request is too deeply nested.",
      );
    if (Array.isArray(value)) {
      if (value.length > 1000)
        throw this.validation("Keap Max Classic array is too large.");
      value.forEach((entry) => this.rejectSecrets(entry, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /token|secret|password|credential|authorization|api[-_]?key/i.test(key)
      )
        throw new KeapMaxClassicApiError(
          "policy_blocked",
          "Keap Max Classic request must not include credentials.",
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

  private requiredPath(value: unknown) {
    if (typeof value !== "string" || !value.trim())
      throw this.validation("Keap Max Classic path is required.");
    const trimmed = value.trim();
    if (trimmed.length > 500)
      throw this.validation("Keap Max Classic path is too long.");
    if (!trimmed.startsWith("/") || trimmed.includes("://"))
      throw this.validation("Keap Max Classic path must be a relative path.");
    return trimmed;
  }

  private requiredMethod(value: unknown): Method {
    if (typeof value !== "string" || !value.trim())
      throw this.validation("Keap Max Classic method is required.");
    const method = value.trim().toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method))
      throw this.validation("Keap Max Classic method is not supported.");
    return method as Method;
  }

  private message(value: unknown): string | null {
    if (!value || typeof value !== "object") return null;
    const record = value as JsonObject;
    const error = record.message ?? record.error ?? record.detail;
    return typeof error === "string" && error.trim()
      ? error.slice(0, 500)
      : null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if ([400, 404, 405, 406, 409, 412, 422].includes(status))
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new KeapMaxClassicApiError(
      "provider_validation_error",
      message,
      400,
    );
  }
}
