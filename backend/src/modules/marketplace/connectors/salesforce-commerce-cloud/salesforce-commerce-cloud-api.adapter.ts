import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import { SALESFORCE_COMMERCE_CLOUD_SCOPES } from "./salesforce-commerce-cloud.connector";

type JsonObject = Record<string, unknown>;
type CachedToken = { accessToken: string; expiresAt: number };
export type SalesforceCommerceCloudCredentials = {
  shortCode: string;
  organizationId: string;
  siteId: string;
  clientId: string;
  clientSecret: string;
  productId: string;
  categoryId: string;
};
export class SalesforceCommerceCloudApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SalesforceCommerceCloudApiAdapter {
  private readonly tokenCache = new Map<string, CachedToken>();

  async health(credentials: SalesforceCommerceCloudCredentials) {
    return this.getProductSummary(credentials);
  }

  async getProductSummary(credentials: SalesforceCommerceCloudCredentials) {
    const row = this.object(
      await this.get(
        credentials,
        `/product/shopper-products/v1/organizations/${credentials.organizationId}/products/${encodeURIComponent(credentials.productId)}`,
      ),
    );
    return {
      product: {
        id: this.text(row.id, credentials.productId, 160),
        name: this.text(row.name, null, 240),
        brand: this.text(row.brand, null, 160),
        online: this.boolean(row.online),
        searchable: this.boolean(row.searchable),
        privateCommerceDataIncluded: false,
      },
    };
  }

  async getCategorySummary(credentials: SalesforceCommerceCloudCredentials) {
    const row = this.object(
      await this.get(
        credentials,
        `/product/shopper-products/v1/organizations/${credentials.organizationId}/categories/${encodeURIComponent(credentials.categoryId)}`,
      ),
    );
    return {
      category: {
        id: this.text(row.id, credentials.categoryId, 160),
        name: this.text(row.name, null, 240),
        online: this.boolean(row.online),
        parentCategoryId: this.text(row.parentCategoryId, null, 160),
        privateCommerceDataIncluded: false,
      },
    };
  }

  private async get(
    credentials: SalesforceCommerceCloudCredentials,
    path: string,
  ) {
    this.validate(credentials);
    const token = await this.token(credentials);
    const base = this.base(credentials);
    const url = new URL(path, base);
    url.searchParams.set("siteId", credentials.siteId);
    const productPath = `/product/shopper-products/v1/organizations/${credentials.organizationId}/products/${encodeURIComponent(credentials.productId)}`;
    const categoryPath = `/product/shopper-products/v1/organizations/${credentials.organizationId}/categories/${encodeURIComponent(credentials.categoryId)}`;
    if (
      url.origin !== base ||
      ![productPath, categoryPath].includes(url.pathname) ||
      url.searchParams.size !== 1 ||
      url.searchParams.get("siteId") !== credentials.siteId ||
      url.hash
    )
      throw new SalesforceCommerceCloudApiError(
        "policy_blocked",
        "Salesforce Commerce Cloud requests must stay on the selected organization, site, product, and category paths.",
        403,
      );
    return this.request(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token.accessToken}`,
      },
    });
  }

  private async token(
    credentials: SalesforceCommerceCloudCredentials,
  ): Promise<CachedToken> {
    this.validate(credentials);
    const cacheKey = createHash("sha256")
      .update(
        [
          credentials.shortCode,
          credentials.organizationId,
          credentials.siteId,
          credentials.clientId,
          credentials.clientSecret,
        ].join("\0"),
      )
      .digest("hex");
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached;
    const url = new URL(
      `/shopper/auth/v1/organizations/${credentials.organizationId}/oauth2/token`,
      this.base(credentials),
    );
    url.searchParams.set("grant_type", "client_credentials");
    url.searchParams.set("channel_id", credentials.siteId);
    const basic = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`,
      "utf8",
    ).toString("base64");
    const row = this.object(
      await this.request(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "",
      }),
    );
    const accessToken =
      typeof row.access_token === "string" ? row.access_token : "";
    const tokenType =
      typeof row.token_type === "string" ? row.token_type : "Bearer";
    if (
      !this.secret(accessToken, 16_000) ||
      tokenType.toLowerCase() !== "bearer"
    )
      throw new SalesforceCommerceCloudApiError(
        "credential_missing",
        "Salesforce Commerce Cloud did not return a valid bearer token.",
        401,
      );
    this.validateTokenScopes(accessToken);
    const expiresIn =
      typeof row.expires_in === "number" &&
      Number.isFinite(row.expires_in) &&
      row.expires_in > 0
        ? Math.min(row.expires_in, 3_600)
        : 1_800;
    const token = {
      accessToken,
      expiresAt: Date.now() + Math.max(1, expiresIn - 120) * 1_000,
    };
    this.tokenCache.set(cacheKey, token);
    return token;
  }

  private validateTokenScopes(token: string) {
    const parts = token.split(".");
    if (parts.length !== 3)
      throw new SalesforceCommerceCloudApiError(
        "insufficient_scope",
        "Salesforce Commerce Cloud token scope could not be verified.",
        403,
      );
    let payload: JsonObject;
    try {
      payload = this.object(
        JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")),
      );
    } catch {
      throw new SalesforceCommerceCloudApiError(
        "insufficient_scope",
        "Salesforce Commerce Cloud token scope could not be verified.",
        403,
      );
    }
    const raw = payload.scp;
    const scopes = Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === "string")
      : typeof raw === "string"
        ? raw.split(/\s+/).filter(Boolean)
        : [];
    const actual = [...new Set(scopes)].sort();
    const expected = [...SALESFORCE_COMMERCE_CLOUD_SCOPES].sort();
    if (
      actual.length !== expected.length ||
      actual.some((scope, index) => scope !== expected[index])
    )
      throw new SalesforceCommerceCloudApiError(
        "insufficient_scope",
        "Salesforce Commerce Cloud requires a dedicated SLAS client with exactly the two selected read scopes.",
        403,
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
      throw new SalesforceCommerceCloudApiError(
        "provider_unavailable",
        "Salesforce Commerce Cloud could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new SalesforceCommerceCloudApiError(
        "policy_blocked",
        "Salesforce Commerce Cloud response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new SalesforceCommerceCloudApiError(
        this.safeCode(response.status),
        `Salesforce Commerce Cloud returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private validate(value: SalesforceCommerceCloudCredentials) {
    if (!/^[a-z0-9]{4,32}$/.test(value.shortCode))
      throw new SalesforceCommerceCloudApiError(
        "provider_validation_error",
        "Salesforce Commerce Cloud requires one exact instance short code.",
        400,
      );
    if (
      !this.identifier(value.organizationId, 100) ||
      !this.identifier(value.siteId, 100) ||
      !this.identifier(value.productId, 160) ||
      !this.identifier(value.categoryId, 160)
    )
      throw new SalesforceCommerceCloudApiError(
        "provider_validation_error",
        "Salesforce Commerce Cloud organization, site, product, and category identifiers must be exact bounded values.",
        400,
      );
    if (
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
        value.clientId,
      ) ||
      !this.secret(value.clientSecret)
    )
      throw new SalesforceCommerceCloudApiError(
        "credential_missing",
        "Valid encrypted Salesforce Commerce Cloud private SLAS credentials are required.",
        401,
      );
  }
  private base(value: SalesforceCommerceCloudCredentials) {
    return `https://${value.shortCode}.api.commercecloud.salesforce.com`;
  }
  private object(value: unknown): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new SalesforceCommerceCloudApiError(
        "provider_validation_error",
        "Salesforce Commerce Cloud returned an invalid bounded result.",
        502,
      );
    return value as JsonObject;
  }
  private identifier(value: string, max: number) {
    return (
      value.length > 0 && value.length <= max && /^[A-Za-z0-9._-]+$/.test(value)
    );
  }
  private secret(value: string, max = 8_000) {
    return Boolean(value) && value.length <= max && !/[\r\n]/.test(value);
  }
  private text(value: unknown, fallback: string | null, max: number) {
    return typeof value === "string" ? value.slice(0, max) : fallback;
  }
  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 409 || status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
