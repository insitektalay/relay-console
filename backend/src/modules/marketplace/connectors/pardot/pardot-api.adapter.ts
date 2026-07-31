import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Environment = "production" | "sandbox" | "developer";
type TokenContext = { accessToken: string; expiresAt: number };
export type PardotCredentials = {
  environment: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  businessUnitId: string;
  prospectId: string;
  campaignId: string;
};

export class PardotApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PardotApiAdapter {
  private readonly tokenCache = new Map<string, TokenContext>();

  async health(credentials: PardotCredentials) {
    return this.getCampaignSummary(credentials);
  }

  async getProspectSummary(credentials: PardotCredentials) {
    const row = await this.get(
      credentials,
      "prospects",
      credentials.prospectId,
      "id,createdAt,updatedAt",
    );
    return {
      prospect: {
        id: this.exactId(row.id, credentials.prospectId, "prospect"),
        createdAt: this.text(row.createdAt, 64),
        updatedAt: this.text(row.updatedAt, 64),
        personalFieldsIncluded: false,
      },
    };
  }

  async getCampaignSummary(credentials: PardotCredentials) {
    const row = await this.get(
      credentials,
      "campaigns",
      credentials.campaignId,
      "id,name,isDeleted,createdAt,updatedAt",
    );
    return {
      campaign: {
        id: this.exactId(row.id, credentials.campaignId, "campaign"),
        name: this.text(row.name, 300),
        isDeleted: typeof row.isDeleted === "boolean" ? row.isDeleted : null,
        createdAt: this.text(row.createdAt, 64),
        updatedAt: this.text(row.updatedAt, 64),
        privateCampaignDetailsIncluded: false,
      },
    };
  }

  private async get(
    credentials: PardotCredentials,
    object: "prospects" | "campaigns",
    id: string,
    fields: string,
  ): Promise<JsonObject> {
    const environment = this.validate(credentials);
    const token = await this.token(credentials, environment);
    const origin = this.apiOrigin(environment);
    const path = `/api/v5/objects/${object}/${id}`;
    const url = new URL(path, origin);
    url.searchParams.set("fields", fields);
    if (
      url.origin !== origin ||
      url.pathname !== path ||
      url.search !== `?fields=${encodeURIComponent(fields)}` ||
      url.hash
    )
      throw new PardotApiError(
        "policy_blocked",
        "Account Engagement requests must stay on one approved selected-resource path.",
        403,
      );
    const value = await this.request(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token.accessToken}`,
        "Pardot-Business-Unit-Id": credentials.businessUnitId,
      },
    });
    return this.object(value, object.slice(0, -1));
  }

  private async token(
    credentials: PardotCredentials,
    environment: Environment,
  ): Promise<TokenContext> {
    const key = createHash("sha256")
      .update(
        [
          environment,
          credentials.clientId,
          credentials.clientSecret,
          credentials.refreshToken,
        ].join("\0"),
      )
      .digest("hex");
    const cached = this.tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached;
    const url = new URL(
      "/services/oauth2/token",
      this.tokenOrigin(environment),
    );
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
    });
    const row = this.object(
      await this.request(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }),
      "token",
    );
    const accessToken =
      typeof row.access_token === "string" ? row.access_token : "";
    if (!this.secret(accessToken, 12_000))
      throw new PardotApiError(
        "token_refresh_failed",
        "Salesforce did not return a valid Account Engagement access token.",
        401,
      );
    const context = { accessToken, expiresAt: Date.now() + 13 * 60 * 1_000 };
    this.tokenCache.set(key, context);
    return context;
  }

  private async request(url: URL, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new PardotApiError(
        "provider_unavailable",
        "Account Engagement could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new PardotApiError(
        "policy_blocked",
        "Account Engagement response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new PardotApiError(
        this.safeCode(response.status),
        `Account Engagement returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private validate(value: PardotCredentials): Environment {
    if (!["production", "sandbox", "developer"].includes(value.environment))
      throw new PardotApiError(
        "provider_validation_error",
        "Account Engagement environment must be production, sandbox, or developer.",
        400,
      );
    if (
      !this.secret(value.clientId) ||
      !this.secret(value.clientSecret) ||
      !this.secret(value.refreshToken, 12_000)
    )
      throw new PardotApiError(
        "credential_missing",
        "Valid encrypted Salesforce OAuth credentials are required.",
        401,
      );
    if (!/^0Uv[A-Za-z0-9]{15}$/.test(value.businessUnitId))
      throw new PardotApiError(
        "provider_validation_error",
        "Account Engagement requires one exact 18-character business unit ID.",
        400,
      );
    if (!this.id(value.prospectId) || !this.id(value.campaignId))
      throw new PardotApiError(
        "provider_validation_error",
        "Account Engagement requires one exact numeric prospect ID and campaign ID.",
        400,
      );
    return value.environment as Environment;
  }

  private tokenOrigin(environment: Environment) {
    return environment === "sandbox"
      ? "https://test.salesforce.com"
      : "https://login.salesforce.com";
  }
  private apiOrigin(environment: Environment) {
    return environment === "production"
      ? "https://pi.pardot.com"
      : "https://pi.demo.pardot.com";
  }
  private exactId(value: unknown, expected: string, kind: string) {
    const actual =
      typeof value === "number"
        ? String(value)
        : typeof value === "string"
          ? value
          : "";
    if (actual !== expected)
      throw new PardotApiError(
        "provider_validation_error",
        `Account Engagement returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return actual;
  }
  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new PardotApiError(
        "provider_validation_error",
        `Account Engagement returned an invalid ${label} result.`,
        502,
      );
    return value as JsonObject;
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }
  private id(value: string) {
    return (
      /^[1-9][0-9]{0,15}$/.test(value) && Number.isSafeInteger(Number(value))
    );
  }
  private secret(value: string, maximum = 8_000) {
    return Boolean(value) && value.length <= maximum && !/[\r\n]/.test(value);
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_refresh_failed";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 400) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
