import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT";
type VagaroScope = "read access" | "write access" | "write employee";
export type VagaroCredentials = {
  clientId: string;
  clientSecret: string;
  region: string;
};

const ID = "[A-Za-z0-9_-]{1,200}";
const READ_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["GET", /^\/api\/v2\/merchants\/access-levels$/],
  ["POST", /^\/api\/v2\/locations$/],
  ["POST", /^\/api\/v2\/customers$/],
  ["POST", /^\/api\/v2\/appointments\/availability$/],
  ["POST", /^\/api\/v2\/appointments$/],
  ["POST", /^\/api\/v2\/employees$/],
  ["POST", /^\/api\/v2\/services$/],
  ["POST", /^\/api\/v2\/personal-tasks\/retrieve$/],
  ["POST", /^\/api\/v2\/cancellation-policies$/],
];
const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", /^\/api\/v2\/merchants\/employees\/assign$/],
  ["POST", /^\/api\/v2\/merchants\/employees\/unassign$/],
  ["PUT", new RegExp(`^/api/v2/employees/working-hours/${ID}$`)],
  ["PUT", new RegExp(`^/api/v2/locations/${ID}$`)],
  ["POST", /^\/api\/v2\/customers\/create$/],
  ["POST", new RegExp(`^/api/v2/customers/${ID}$`)],
  ["PUT", new RegExp(`^/api/v2/customers/${ID}$`)],
  ["POST", /^\/api\/v2\/appointments\/create$/],
  ["PUT", new RegExp(`^/api/v2/appointments/${ID}$`)],
  ["POST", new RegExp(`^/api/v2/appointments/delete/${ID}$`)],
  ["PUT", new RegExp(`^/api/v2/employees/${ID}$`)],
  ["POST", new RegExp(`^/api/v2/employees/${ID}$`)],
  ["POST", /^\/api\/v2\/services\/create$/],
  ["PUT", new RegExp(`^/api/v2/services/${ID}$`)],
  ["POST", new RegExp(`^/api/v2/services/${ID}$`)],
  ["POST", /^\/api\/v2\/personal-tasks\/create$/],
  ["PUT", new RegExp(`^/api/v2/personal-tasks/${ID}$`)],
  ["POST", new RegExp(`^/api/v2/personal-tasks/delete/${ID}$`)],
];
const WRITE_EMPLOYEE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", /^\/api\/v2\/merchants\/employees\/(?:assign|unassign)$/],
  ["PUT", new RegExp(`^/api/v2/employees/working-hours/${ID}$`)],
  ["PUT", new RegExp(`^/api/v2/locations/${ID}$`)],
  ["POST", new RegExp(`^/api/v2/customers/${ID}$`)],
  ["PUT", new RegExp(`^/api/v2/employees/${ID}$`)],
  ["POST", new RegExp(`^/api/v2/employees/${ID}$`)],
  ["POST", /^\/api\/v2\/personal-tasks\/create$/],
  ["PUT", new RegExp(`^/api/v2/personal-tasks/${ID}$`)],
  ["POST", new RegExp(`^/api/v2/personal-tasks/delete/${ID}$`)],
];

export class VagaroApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class VagaroApiAdapter {
  async health(credentials: VagaroCredentials) {
    const normalized = this.credentials(credentials);
    await this.accessToken(normalized, "read access");
    return { credentialsVerified: true, region: normalized.region };
  }

  read(credentials: VagaroCredentials, input: JsonObject) {
    const method = String(input.method ?? "POST").toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (!this.matches(READ_ROUTES, method, path))
      throw this.validation("Vagaro retrieval endpoint is not supported.");
    return this.request(credentials, {
      method,
      path,
      scope: "read access",
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  manage(credentials: VagaroCredentials, input: JsonObject) {
    const method = this.required(
      input.method,
      "method",
      10,
    ).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (!this.matches(MANAGE_ROUTES, method, path))
      throw this.validation("Vagaro mutation endpoint is not supported.");
    const scope: VagaroScope = this.matches(WRITE_EMPLOYEE_ROUTES, method, path)
      ? "write employee"
      : "write access";
    return this.request(credentials, {
      method,
      path,
      scope,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  private credentials(credentials: VagaroCredentials) {
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    const region = credentials.region?.trim().toLowerCase();
    if (!clientId || clientId.length > 10_000)
      throw new VagaroApiError(
        "credential_missing",
        "Vagaro client ID is required.",
        401,
      );
    if (!clientSecret || clientSecret.length > 10_000)
      throw new VagaroApiError(
        "credential_missing",
        "Vagaro client secret is required.",
        401,
      );
    if (!/^[a-z]{2}\d{2}$/.test(region ?? ""))
      throw new VagaroApiError(
        "credential_missing",
        "Vagaro region must match the account URL code, such as us04.",
        401,
      );
    return { clientId, clientSecret, region: region! };
  }

  private async accessToken(
    credentials: VagaroCredentials,
    scope: VagaroScope,
  ) {
    const url = new URL(
      `https://api.vagaro.com/${credentials.region}/api/v2/merchants/generate-access-token`,
    );
    try {
      const response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: credentials.clientId,
          clientSecretKey: credentials.clientSecret,
          scope,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Vagaro token response exceeds 1 MB.");
      const data = this.parse(raw);
      if (!response.ok)
        throw new VagaroApiError(
          response.status === 429
            ? "provider_rate_limited"
            : "token_refresh_failed",
          this.message(data) ?? "Vagaro rejected the client credentials.",
          response.status,
        );
      const token = this.object(this.object(data)?.data)?.access_token;
      if (typeof token !== "string" || !token.trim() || token.length > 10_000)
        throw new VagaroApiError(
          "token_refresh_failed",
          "Vagaro did not return an access token.",
          502,
        );
      return token.trim();
    } catch (error) {
      if (error instanceof VagaroApiError) throw error;
      throw new VagaroApiError(
        "provider_unavailable",
        "Vagaro's token service could not be reached.",
        502,
      );
    }
  }

  private async request(
    rawCredentials: VagaroCredentials,
    input: {
      method: Method;
      path: string;
      scope: VagaroScope;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const permitted =
      this.matches(READ_ROUTES, input.method, input.path) ||
      this.matches(MANAGE_ROUTES, input.method, input.path);
    if (!permitted) throw this.validation("Vagaro endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const credentials = this.credentials(rawCredentials);
    const accessToken = await this.accessToken(credentials, input.scope);
    const url = new URL(
      `https://api.vagaro.com/${credentials.region}${input.path}`,
    );
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      accessToken,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.validation("Vagaro request exceeds 2 MB.");
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
        throw this.validation("Vagaro response exceeds 5 MB.");
      let data = this.parse(raw);
      data = this.redact(data);
      if (!response.ok)
        throw new VagaroApiError(
          this.code(response.status),
          this.message(data) ?? `Vagaro returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof VagaroApiError) throw error;
      throw new VagaroApiError(
        "provider_unavailable",
        "Vagaro could not be reached.",
        502,
      );
    }
  }

  private matches(
    routes: ReadonlyArray<[Method, RegExp]>,
    method: Method,
    path: string,
  ) {
    return routes.some(
      ([allowed, pattern]) => allowed === method && pattern.test(path),
    );
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 20)
      throw this.validation("Vagaro query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(key))
        throw this.validation("Vagaro query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 50)
        throw this.validation("Vagaro query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Vagaro query value is invalid.");
        params.append(key, String(child).slice(0, 10_000));
      }
    }
  }

  private parse(raw: Buffer): unknown {
    const text = raw.toString("utf8");
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text.slice(0, 1_000_000);
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
        throw new VagaroApiError(
          "policy_blocked",
          "Vagaro request is too deeply nested.",
        );
      if (Array.isArray(item)) {
        if (item.length > 1000)
          throw new VagaroApiError(
            "policy_blocked",
            "Vagaro request array is too large.",
          );
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000)
        throw new VagaroApiError(
          "policy_blocked",
          "Vagaro request object is too large.",
        );
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new VagaroApiError(
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
    const object = this.object(value);
    const candidate = object?.message ?? object?.msg ?? object?.error;
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
    return new VagaroApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
}
