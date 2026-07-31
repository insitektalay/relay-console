import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  SALESFORCE_DATA_CLOUD_OPERATION_BY_ID,
  type SalesforceDataCloudOperation,
} from "./salesforce-data-cloud-operation-registry";

type JsonObject = Record<string, unknown>;
export type SalesforceDataCloudCredentials = {
  clientId: string;
  clientSecret: string;
  loginEnvironment: string;
};
export type SalesforceDataCloudInput = {
  queryId?: unknown;
  sql?: unknown;
  rowLimit?: unknown;
  offset?: unknown;
};

@Injectable()
export class SalesforceDataCloudApiAdapter {
  private static readonly LOGIN_ORIGINS: Record<string, string> = {
    production: "https://login.salesforce.com",
    sandbox: "https://test.salesforce.com",
  };
  private readonly tokens = new Map<
    string,
    { token: string; origin: string; expiresAt: number }
  >();

  async health(credentials: SalesforceDataCloudCredentials) {
    const token = await this.dataCloudToken(credentials);
    return { authenticated: true, dataCloudOrigin: token.origin };
  }

  read(
    credentials: SalesforceDataCloudCredentials,
    operationId: string,
    input: SalesforceDataCloudInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: SalesforceDataCloudCredentials,
    operation: SalesforceDataCloudOperation,
    input: SalesforceDataCloudInput,
  ) {
    this.rejectSecrets(input);
    let path = operation.path;
    if (path.includes("{queryId}"))
      path = path.replace("{queryId}", this.queryId(input.queryId));
    const relativeUrl = new URL(path, "https://data-cloud.invalid");
    let body: string | undefined;
    if (operation.id === "submit_bounded_query") {
      body = JSON.stringify({
        sql: this.sql(input.sql),
        transferMode: "ASYNC",
        queryRowLimit: this.integer(input.rowLimit, "rowLimit", 1, 200),
      });
    } else if (input.sql !== undefined || input.rowLimit !== undefined) {
      throw this.validation(
        "Salesforce Data Cloud SQL and rowLimit are accepted only when submitting a query.",
      );
    }
    if (operation.id === "get_query_rows") {
      relativeUrl.searchParams.set(
        "offset",
        String(this.integer(input.offset, "offset", 0, 1_000_000)),
      );
      relativeUrl.searchParams.set("limit", "200");
      relativeUrl.searchParams.set("byteLimit", "1000000");
      relativeUrl.searchParams.set("omitSchema", "false");
    } else if (input.offset !== undefined) {
      throw this.validation(
        "Salesforce Data Cloud offset is accepted only when retrieving rows.",
      );
    }
    const token = await this.dataCloudToken(credentials);
    const url = new URL(
      `${relativeUrl.pathname}${relativeUrl.search}`,
      token.origin,
    );
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token.token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_250_000)
        throw this.validation(
          "Salesforce Data Cloud response exceeds 1.25 MB.",
        );
      const data = this.parseJson(raw, "query response");
      if (!response.ok)
        throw new SalesforceDataCloudApiError(
          this.safeCode(response.status),
          `Salesforce Data Cloud returned HTTP ${response.status}.`,
          response.status,
        );
      const status = this.queryStatus(response.headers.get("status"));
      return {
        data: this.redact(data),
        ...(status ? { queryStatus: this.redact(status) } : {}),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof SalesforceDataCloudApiError) throw error;
      throw new SalesforceDataCloudApiError(
        "provider_unavailable",
        "Salesforce Data Cloud could not be reached.",
      );
    }
  }

  private async dataCloudToken(credentials: SalesforceDataCloudCredentials) {
    const clientId = credentials.clientId.trim();
    const clientSecret = credentials.clientSecret.trim();
    const loginOrigin =
      SalesforceDataCloudApiAdapter.LOGIN_ORIGINS[
        credentials.loginEnvironment.trim().toLowerCase()
      ];
    if (
      !clientId ||
      !clientSecret ||
      !loginOrigin ||
      clientId.length > 500 ||
      clientSecret.length > 20_000
    )
      throw new SalesforceDataCloudApiError(
        "credential_missing",
        "Salesforce Data Cloud client credentials or login environment are missing.",
      );
    const key = createHash("sha256")
      .update(`${loginOrigin}\0${clientId}\0${clientSecret}`)
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached;

    const core = await this.tokenRequest(
      `${loginOrigin}/services/oauth2/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      "Salesforce OAuth client-credentials exchange",
    );
    const coreToken = this.requiredToken(core.access_token, "Salesforce");
    const coreOrigin = this.salesforceOrigin(core.instance_url);
    const dataCloud = await this.tokenRequest(
      `${coreOrigin}/services/a360/token`,
      new URLSearchParams({
        grant_type: "urn:salesforce:grant-type:external:cdp",
        subject_token: coreToken,
        subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      }),
      "Salesforce Data Cloud token exchange",
    );
    const token = this.requiredToken(
      dataCloud.access_token,
      "Salesforce Data Cloud",
    );
    const origin = this.dataCloudOrigin(dataCloud.instance_url);
    const expiresIn = Number(dataCloud.expires_in);
    if (!Number.isFinite(expiresIn) || expiresIn < 1)
      throw new SalesforceDataCloudApiError(
        "token_refresh_failed",
        "Salesforce Data Cloud did not return a usable token lifetime.",
      );
    const value = {
      token,
      origin,
      expiresAt: Date.now() + Math.min(expiresIn, 10_800) * 1_000,
    };
    this.tokens.set(key, value);
    return value;
  }

  private async tokenRequest(
    url: string,
    parameters: URLSearchParams,
    label: string,
  ) {
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: parameters.toString(),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new SalesforceDataCloudApiError(
        "token_refresh_failed",
        `${label} failed.`,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 64_000)
      throw new SalesforceDataCloudApiError(
        "token_refresh_failed",
        `${label} returned an invalid response.`,
      );
    const data = this.parseJson(raw, "token response");
    if (!response.ok)
      throw new SalesforceDataCloudApiError(
        "token_refresh_failed",
        `${label} returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private salesforceOrigin(value: unknown) {
    const url = this.strictOrigin(value, "Salesforce instance");
    if (!url.hostname.endsWith(".salesforce.com"))
      throw new SalesforceDataCloudApiError(
        "token_refresh_failed",
        "Salesforce returned an invalid instance origin.",
      );
    return url.origin;
  }

  private dataCloudOrigin(value: unknown) {
    const url = this.strictOrigin(value, "Salesforce Data Cloud instance");
    if (!url.hostname.endsWith(".c360a.salesforce.com"))
      throw new SalesforceDataCloudApiError(
        "token_refresh_failed",
        "Salesforce Data Cloud returned an invalid tenant origin.",
      );
    return url.origin;
  }

  private strictOrigin(value: unknown, label: string) {
    if (typeof value !== "string" || value.length > 2_000)
      throw new SalesforceDataCloudApiError(
        "token_refresh_failed",
        `${label} is invalid.`,
      );
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw new Error("invalid origin");
      return url;
    } catch {
      throw new SalesforceDataCloudApiError(
        "token_refresh_failed",
        `${label} is invalid.`,
      );
    }
  }

  private sql(value: unknown) {
    const sql = typeof value === "string" ? value.trim() : "";
    if (
      sql.length < 1 ||
      sql.length > 8_000 ||
      !/^select\b/i.test(sql) ||
      /[;*\u0000]/.test(sql) ||
      /--|\/\*|\*\//.test(sql) ||
      /\b(insert|update|delete|merge|upsert|drop|alter|create|truncate|grant|revoke|call|execute)\b/i.test(
        sql,
      )
    )
      throw this.validation(
        "Salesforce Data Cloud SQL must be one bounded SELECT without wildcards, comments, separators, or mutation keywords.",
      );
    return sql;
  }

  private queryId(value: unknown) {
    const id = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9._~-]{1,300}$/.test(id))
      throw this.validation("Salesforce Data Cloud queryId is invalid.");
    return encodeURIComponent(id);
  }

  private integer(
    value: unknown,
    label: string,
    minimum: number,
    maximum: number,
  ) {
    const number = typeof value === "number" ? value : Number.NaN;
    if (!Number.isSafeInteger(number) || number < minimum || number > maximum)
      throw this.validation(
        `Salesforce Data Cloud ${label} must be an integer from ${minimum} to ${maximum}.`,
      );
    return number;
  }

  private operation(id: string) {
    const operation = SALESFORCE_DATA_CLOUD_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new SalesforceDataCloudApiError(
        "tool_unavailable",
        "Salesforce Data Cloud operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: SalesforceDataCloudInput) {
    for (const key of Object.keys(value))
      if (
        /(client.?id|client.?secret|access.?token|refresh.?token|authorization|cookie|url|uri|endpoint|origin|environment)/i.test(
          key,
        )
      )
        throw new SalesforceDataCloudApiError(
          "policy_blocked",
          "Credential or routing Salesforce Data Cloud input fields are blocked.",
        );
  }

  private requiredToken(value: unknown, label: string) {
    if (typeof value !== "string" || value.length < 1 || value.length > 20_000)
      throw new SalesforceDataCloudApiError(
        "token_refresh_failed",
        `${label} did not return a usable access token.`,
      );
    return value;
  }

  private queryStatus(value: string | null) {
    if (!value) return null;
    if (value.length > 64_000)
      throw this.validation(
        "Salesforce Data Cloud query status header is oversized.",
      );
    return this.parseJson(Buffer.from(value), "query status header");
  }

  private parseJson(raw: Buffer, label: string): JsonObject {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object" && !Array.isArray(value))
        return value as JsonObject;
    } catch {
      /* normalize */
    }
    throw this.validation(
      `Salesforce Data Cloud returned an invalid ${label}.`,
    );
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 200).map((entry) => this.redact(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, child]) => [
          key,
          /(client.?secret|refresh.?token|access.?token|authorization|cookie)/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(child),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new SalesforceDataCloudApiError(
      "provider_validation_error",
      message,
    );
  }
}

export class SalesforceDataCloudApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
