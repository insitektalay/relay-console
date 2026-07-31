import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type PartnerFinanceCredentials = Record<string, unknown>;

type ProviderConfig = {
  name: string;
  origins: string[];
  prepare: (credentials: PartnerFinanceCredentials) => Promise<{
    origin: string;
    headers: Record<string, string>;
    injectBody?: JsonObject;
  }>;
  health: {
    method: "GET" | "POST";
    path: string;
    query?: JsonObject;
    json?: JsonObject;
  };
};

export class PartnerFinanceApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PartnerFinanceApiAdapter {
  async health(slug: string, credentials: PartnerFinanceCredentials) {
    const config = this.provider(slug);
    return this.request(slug, credentials, config.health);
  }

  read(
    slug: string,
    credentials: PartnerFinanceCredentials,
    input: JsonObject,
  ) {
    return this.request(slug, credentials, {
      method: this.method(input.method ?? "GET", ["GET", "POST"]),
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  manage(
    slug: string,
    credentials: PartnerFinanceCredentials,
    input: JsonObject,
  ) {
    return this.request(slug, credentials, {
      method: this.method(input.method, ["POST", "PUT", "PATCH", "DELETE"]),
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  async request(
    slug: string,
    credentials: PartnerFinanceCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const config = this.provider(slug);
    if (
      !/^\/[A-Za-z0-9][A-Za-z0-9_./:@%+~-]*$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("//") ||
      input.path.includes("?") ||
      input.path.includes("#")
    )
      throw this.validation(`${config.name} API path is invalid.`);
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const auth = await config.prepare(credentials);
    const origin = new URL(auth.origin);
    if (
      origin.protocol !== "https:" ||
      !config.origins.includes(origin.hostname) ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash
    )
      throw this.validation(`${config.name} API origin is not allowed.`);
    const basePath = origin.pathname.replace(/\/$/, "");
    const url = new URL(
      `${basePath}${input.path}`,
      `${origin.protocol}//${origin.host}`,
    );
    this.appendQuery(url.searchParams, input.query);
    const json = { ...(auth.injectBody ?? {}), ...(input.json ?? {}) };
    const hasBody = input.method !== "GET" && Object.keys(json).length > 0;
    const body = hasBody ? JSON.stringify(json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000)
      throw this.validation(`${config.name} request exceeds 1 MB.`);
    const response = await safeConnectorFetch(url, {
      method: input.method,
      headers: {
        Accept: "application/json",
        ...auth.headers,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 5_000_000)
      throw this.validation(`${config.name} response exceeds 5 MB.`);
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw.slice(0, 5_000_000);
    }
    data = this.redact(data);
    if (!response.ok)
      throw new PartnerFinanceApiError(
        this.code(response.status),
        this.message(data) ??
          `${config.name} returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private provider(slug: string): ProviderConfig {
    if (slug === "etoro")
      return {
        name: "eToro",
        origins: ["public-api.etoro.com"],
        health: { method: "GET", path: "/api/v1/watchlists" },
        prepare: async (credentials) => ({
          origin: "https://public-api.etoro.com",
          headers: {
            "x-request-id": randomUUID(),
            "x-api-key": this.required(
              credentials.ETORO_PUBLIC_API_KEY,
              "ETORO_PUBLIC_API_KEY",
              2000,
            ),
            "x-user-key": this.required(
              credentials.ETORO_USER_KEY,
              "ETORO_USER_KEY",
              4000,
            ),
          },
        }),
      };
    if (slug === "plaid-link")
      return {
        name: "Plaid",
        origins: [
          "sandbox.plaid.com",
          "development.plaid.com",
          "production.plaid.com",
        ],
        health: { method: "POST", path: "/item/get" },
        prepare: async (credentials) => ({
          origin: this.required(
            credentials.PLAID_API_ORIGIN,
            "PLAID_API_ORIGIN",
            500,
          ),
          headers: {},
          injectBody: {
            client_id: this.required(
              credentials.PLAID_CLIENT_ID,
              "PLAID_CLIENT_ID",
              500,
            ),
            secret: this.required(
              credentials.PLAID_SECRET,
              "PLAID_SECRET",
              2000,
            ),
            access_token: this.required(
              credentials.PLAID_ACCESS_TOKEN,
              "PLAID_ACCESS_TOKEN",
              4000,
            ),
          },
        }),
      };
    if (slug === "finicity")
      return {
        name: "Finicity",
        origins: ["api.finicity.com"],
        health: {
          method: "GET",
          path: "/institution/v2/institutions",
          query: { start: 1, limit: 1 },
        },
        prepare: async (credentials) => {
          const origin = this.required(
            credentials.FINICITY_API_ORIGIN,
            "FINICITY_API_ORIGIN",
            500,
          );
          const partnerId = this.required(
            credentials.FINICITY_PARTNER_ID,
            "FINICITY_PARTNER_ID",
            500,
          );
          const partnerSecret = this.required(
            credentials.FINICITY_PARTNER_SECRET,
            "FINICITY_PARTNER_SECRET",
            2000,
          );
          const appKey = this.required(
            credentials.FINICITY_APP_KEY,
            "FINICITY_APP_KEY",
            2000,
          );
          const checked = new URL(origin);
          if (
            checked.protocol !== "https:" ||
            checked.hostname !== "api.finicity.com"
          )
            throw this.validation("Finicity API origin is not allowed.");
          const response = await safeConnectorFetch(
            new URL(
              "/aggregation/v2/partners/authentication",
              `${checked.protocol}//${checked.host}`,
            ),
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "Finicity-App-Key": appKey,
              },
              body: JSON.stringify({ partnerId, partnerSecret }),
              redirect: "error",
              signal: AbortSignal.timeout(30_000),
            },
          );
          const raw = await response.text();
          let data: JsonObject = {};
          try {
            data = raw ? (JSON.parse(raw) as JsonObject) : {};
          } catch {
            data = {};
          }
          const token = typeof data.token === "string" ? data.token : null;
          if (!response.ok || !token)
            throw new PartnerFinanceApiError(
              this.code(response.status),
              "Finicity could not issue a partner app token.",
              response.status,
            );
          return {
            origin,
            headers: {
              "Finicity-App-Key": appKey,
              "Finicity-App-Token": token,
            },
          };
        },
      };
    if (slug === "mx")
      return {
        name: "MX",
        origins: ["api.mx.com", "int-api.mx.com"],
        health: {
          method: "GET",
          path: "/users",
          query: { records_per_page: 10 },
        },
        prepare: async (credentials) => {
          const origin = this.required(
            credentials.MX_API_ORIGIN,
            "MX_API_ORIGIN",
            500,
          );
          const clientId = this.required(
            credentials.MX_CLIENT_ID,
            "MX_CLIENT_ID",
            500,
          );
          const apiKey = this.required(
            credentials.MX_API_KEY,
            "MX_API_KEY",
            2000,
          );
          return {
            origin,
            headers: {
              Authorization: `Basic ${Buffer.from(`${clientId}:${apiKey}`).toString("base64")}`,
              "Accept-Version": "2026-01-01",
            },
          };
        },
      };
    if (slug === "yodlee-fastlink")
      return {
        name: "Yodlee",
        origins: ["api.yodlee.com", "sandbox.api.yodlee.com"],
        health: { method: "GET", path: "/accounts", query: { top: 1 } },
        prepare: async (credentials) => {
          const origin = this.required(
            credentials.YODLEE_API_ORIGIN,
            "YODLEE_API_ORIGIN",
            500,
          );
          const clientId = this.required(
            credentials.YODLEE_CLIENT_ID,
            "YODLEE_CLIENT_ID",
            500,
          );
          const secret = this.required(
            credentials.YODLEE_CLIENT_SECRET,
            "YODLEE_CLIENT_SECRET",
            2000,
          );
          const loginName = this.required(
            credentials.YODLEE_LOGIN_NAME,
            "YODLEE_LOGIN_NAME",
            500,
          );
          const checked = new URL(origin);
          if (
            checked.protocol !== "https:" ||
            !["api.yodlee.com", "sandbox.api.yodlee.com"].includes(
              checked.hostname,
            )
          )
            throw this.validation("Yodlee API origin is not allowed.");
          const tokenUrl = new URL(
            `${checked.pathname.replace(/\/$/, "")}/auth/token`,
            `${checked.protocol}//${checked.host}`,
          );
          const response = await safeConnectorFetch(tokenUrl, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ clientId, secret, loginName }),
            redirect: "error",
            signal: AbortSignal.timeout(30_000),
          });
          const raw = await response.text();
          let data: JsonObject = {};
          try {
            data = raw ? (JSON.parse(raw) as JsonObject) : {};
          } catch {
            data = {};
          }
          const token =
            typeof data.token === "string"
              ? data.token
              : typeof data.accessToken === "string"
                ? data.accessToken
                : null;
          if (!response.ok || !token)
            throw new PartnerFinanceApiError(
              this.code(response.status),
              "Yodlee could not issue a user access token.",
              response.status,
            );
          return {
            origin,
            headers: { Authorization: `Bearer ${token}`, "Api-Version": "1.1" },
          };
        },
      };
    throw this.validation(`Unsupported partner finance provider: ${slug}.`);
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw this.validation("Query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_.\[\]$-]{1,100}$/.test(key))
        throw this.validation("Query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.validation("Query array is too large.");
      for (const entry of values) {
        if (!["string", "number", "boolean"].includes(typeof entry))
          throw this.validation("Query value is invalid.");
        params.append(key, String(entry).slice(0, 10_000));
      }
    }
  }

  private rejectSecrets(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new PartnerFinanceApiError(
          "policy_blocked",
          "Request is too deeply nested.",
        );
      if (Array.isArray(item))
        return item.forEach((child) => walk(child, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, child] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key|client.?id)/i.test(
            key,
          )
        )
          throw new PartnerFinanceApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 250_000);
    if (Array.isArray(value))
      return value.slice(0, 250).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 250)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }
  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new PartnerFinanceApiError(
        "credential_missing",
        `${name} is required.`,
      );
    return value.trim();
  }
  private method(value: unknown, allowed: string[]) {
    const method = typeof value === "string" ? value.toUpperCase() : "";
    if (!allowed.includes(method))
      throw this.validation("HTTP method is not allowed for this action.");
    return method;
  }
  private validation(message: string) {
    return new PartnerFinanceApiError("provider_validation_error", message);
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private message(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const o = value as JsonObject;
    const v = o.message ?? o.errorMessage ?? o.error ?? o.detail;
    return typeof v === "string" ? v.slice(0, 500) : null;
  }
}
