import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type TokenContext = {
  accessToken: string;
  restBaseUrl: string;
  expiresAt: number;
};

export type SalesforceMarketingCloudCredentials = {
  subdomain: string;
  clientId: string;
  clientSecret: string;
  accountId: string;
};

export class SalesforceMarketingCloudApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SalesforceMarketingCloudApiAdapter {
  private readonly tokenCache = new Map<string, TokenContext>();

  async health(credentials: SalesforceMarketingCloudCredentials) {
    return this.getBusinessUnitContext(credentials);
  }

  async getBusinessUnitContext(
    credentials: SalesforceMarketingCloudCredentials,
  ) {
    const token = await this.token(credentials);
    await this.get(token, "/platform/v1/tokenContext");
    return {
      businessUnit: {
        accountId: credentials.accountId,
        tokenContextAvailable: true,
        privateContextIncluded: false,
        requestedScope: "",
      },
    };
  }

  async getEndpointSummary(credentials: SalesforceMarketingCloudCredentials) {
    const token = await this.token(credentials);
    await this.get(token, "/platform/v1/endpoints");
    return {
      endpoints: {
        accountId: credentials.accountId,
        restHost: new URL(token.restBaseUrl).hostname,
        platformEndpointsAvailable: true,
        rawEndpointDetailsIncluded: false,
        requestedScope: "",
      },
    };
  }

  private async token(
    credentials: SalesforceMarketingCloudCredentials,
  ): Promise<TokenContext> {
    this.validateCredentials(credentials);
    const cacheKey = createHash("sha256")
      .update(
        [
          credentials.subdomain,
          credentials.accountId,
          credentials.clientId,
          credentials.clientSecret,
        ].join("\0"),
      )
      .digest("hex");
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached;

    const url = new URL(
      `https://${credentials.subdomain}.auth.marketingcloudapis.com/v2/token`,
    );
    const value = await this.request(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        account_id: Number(credentials.accountId),
        scope: "",
      }),
    });
    const row = this.object(value);
    const accessToken =
      typeof row.access_token === "string" ? row.access_token : "";
    const tokenType =
      typeof row.token_type === "string" ? row.token_type : "Bearer";
    const returnedScope = typeof row.scope === "string" ? row.scope.trim() : "";
    const restBaseUrl =
      typeof row.rest_instance_url === "string" ? row.rest_instance_url : "";
    if (
      !this.secret(accessToken, 2_000) ||
      tokenType.toLowerCase() !== "bearer"
    )
      throw new SalesforceMarketingCloudApiError(
        "credential_missing",
        "Salesforce Marketing Cloud did not return a valid bearer token.",
        401,
      );
    if (returnedScope)
      throw new SalesforceMarketingCloudApiError(
        "policy_blocked",
        "Salesforce Marketing Cloud returned non-empty authority for a zero-scope request.",
        403,
      );
    this.validateRestBase(restBaseUrl);
    const expiresIn =
      typeof row.expires_in === "number" &&
      Number.isFinite(row.expires_in) &&
      row.expires_in > 0
        ? Math.min(row.expires_in, 1_200)
        : 1_080;
    const context = {
      accessToken,
      restBaseUrl: new URL(restBaseUrl).origin,
      expiresAt: Date.now() + Math.max(1, expiresIn - 120) * 1_000,
    };
    this.tokenCache.set(cacheKey, context);
    return context;
  }

  private async get(token: TokenContext, path: string) {
    const url = new URL(path, token.restBaseUrl);
    if (
      url.origin !== token.restBaseUrl ||
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".rest.marketingcloudapis.com") ||
      !["/platform/v1/tokenContext", "/platform/v1/endpoints"].includes(
        url.pathname,
      ) ||
      url.search ||
      url.hash
    )
      throw new SalesforceMarketingCloudApiError(
        "policy_blocked",
        "Salesforce Marketing Cloud requests must stay on an approved selected-tenant platform path.",
        403,
      );
    const value = await this.request(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token.accessToken}`,
      },
    });
    if (value === null || typeof value !== "object")
      throw new SalesforceMarketingCloudApiError(
        "provider_validation_error",
        "Salesforce Marketing Cloud returned an invalid platform result.",
        502,
      );
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
      throw new SalesforceMarketingCloudApiError(
        "provider_unavailable",
        "Salesforce Marketing Cloud could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new SalesforceMarketingCloudApiError(
        "policy_blocked",
        "Salesforce Marketing Cloud response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new SalesforceMarketingCloudApiError(
        this.safeCode(response.status),
        `Salesforce Marketing Cloud returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private validateCredentials(value: SalesforceMarketingCloudCredentials) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value.subdomain))
      throw new SalesforceMarketingCloudApiError(
        "provider_validation_error",
        "Salesforce Marketing Cloud requires one exact tenant subdomain.",
        400,
      );
    if (!this.secret(value.clientId) || !this.secret(value.clientSecret))
      throw new SalesforceMarketingCloudApiError(
        "credential_missing",
        "Valid encrypted Salesforce Marketing Cloud client credentials are required.",
        401,
      );
    if (
      !/^[1-9][0-9]{0,15}$/.test(value.accountId) ||
      !Number.isSafeInteger(Number(value.accountId))
    )
      throw new SalesforceMarketingCloudApiError(
        "provider_validation_error",
        "Salesforce Marketing Cloud account_id must be one exact numeric MID.",
        400,
      );
  }

  private validateRestBase(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new SalesforceMarketingCloudApiError(
        "provider_validation_error",
        "Salesforce Marketing Cloud returned an invalid REST base URL.",
        502,
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.hostname.includes("..") ||
      !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.rest\.marketingcloudapis\.com$/.test(
        url.hostname,
      )
    )
      throw new SalesforceMarketingCloudApiError(
        "policy_blocked",
        "Salesforce Marketing Cloud REST calls must use the trusted tenant origin returned by the token service.",
        403,
      );
  }

  private object(value: unknown): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new SalesforceMarketingCloudApiError(
        "provider_validation_error",
        "Salesforce Marketing Cloud returned an invalid token result.",
        502,
      );
    return value as JsonObject;
  }

  private secret(value: string, maximum = 8_000) {
    return Boolean(value) && value.length <= maximum && !/[\r\n]/.test(value);
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
