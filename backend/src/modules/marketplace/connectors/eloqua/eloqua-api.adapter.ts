import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type EloquaContext = {
  accessToken: string;
  apiOrigin: string;
  expiresAt: number;
};

export type EloquaCredentials = {
  siteName: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  contactId: string;
  campaignId: string;
};

export class EloquaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class EloquaApiAdapter {
  private readonly contextCache = new Map<string, EloquaContext>();

  async health(credentials: EloquaCredentials) {
    return this.getCampaignSummary(credentials);
  }

  async getContactSummary(credentials: EloquaCredentials) {
    const row = await this.get(
      credentials,
      `/API/REST/2.0/data/contact/${credentials.contactId}`,
    );
    return {
      contact: {
        id: this.exactId(row.id, credentials.contactId, "contact"),
        createdAt: this.text(row.createdAt, 64),
        updatedAt: this.text(row.updatedAt, 64),
        personalFieldsIncluded: false,
      },
    };
  }

  async getCampaignSummary(credentials: EloquaCredentials) {
    const row = await this.get(
      credentials,
      `/API/REST/2.0/assets/campaign/${credentials.campaignId}`,
    );
    return {
      campaign: {
        id: this.exactId(row.id, credentials.campaignId, "campaign"),
        name: this.text(row.name, 300),
        currentStatus: this.text(row.currentStatus, 100),
        createdAt: this.text(row.createdAt, 64),
        updatedAt: this.text(row.updatedAt, 64),
        privateCampaignDetailsIncluded: false,
      },
    };
  }

  private async get(credentials: EloquaCredentials, path: string) {
    this.validate(credentials);
    const context = await this.context(credentials);
    const url = new URL(path, context.apiOrigin);
    url.searchParams.set("depth", "minimal");
    if (
      url.origin !== context.apiOrigin ||
      url.pathname !== path ||
      url.search !== "?depth=minimal" ||
      url.hash
    )
      throw new EloquaApiError(
        "policy_blocked",
        "Eloqua requests must stay on one approved selected-resource path.",
        403,
      );
    return this.object(
      await this.request(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${context.accessToken}`,
        },
      }),
      "resource",
    );
  }

  private async context(credentials: EloquaCredentials) {
    const key = createHash("sha256")
      .update(
        [
          credentials.siteName,
          credentials.clientId,
          credentials.clientSecret,
          credentials.refreshToken,
        ].join("\0"),
      )
      .digest("hex");
    const cached = this.contextCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached;

    const tokenRow = this.object(
      await this.request(
        new URL("https://login.eloqua.com/auth/oauth2/token"),
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Basic ${Buffer.from(
              `${credentials.clientId}:${credentials.clientSecret}`,
            ).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: credentials.refreshToken,
            scope: "full",
          }),
        },
      ),
      "token",
    );
    const accessToken = this.secretValue(tokenRow.access_token, 12_000);
    if (!accessToken)
      throw new EloquaApiError(
        "token_refresh_failed",
        "Eloqua did not return a valid access token.",
        401,
      );

    const identity = this.object(
      await this.request(new URL("https://login.eloqua.com/id"), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }),
      "identity",
    );
    const site = this.object(identity.site, "site");
    if (site.name !== credentials.siteName)
      throw new EloquaApiError(
        "insufficient_scope",
        "The Eloqua OAuth grant belongs to a different site than the selected site.",
        403,
      );
    const urls = this.object(identity.urls, "identity URLs");
    const apiOrigin = this.approvedOrigin(urls.base);
    const expiresIn =
      typeof tokenRow.expires_in === "number" &&
      Number.isFinite(tokenRow.expires_in)
        ? tokenRow.expires_in
        : 3_600;
    const context = {
      accessToken,
      apiOrigin,
      expiresAt:
        Date.now() + Math.max(1, Math.min(expiresIn - 300, 3_300)) * 1_000,
    };
    this.contextCache.set(key, context);
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
      throw new EloquaApiError(
        "provider_unavailable",
        "Eloqua could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new EloquaApiError(
        "policy_blocked",
        "Eloqua response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new EloquaApiError(
        this.safeCode(response.status, url.pathname.includes("oauth2/token")),
        `Eloqua returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private validate(value: EloquaCredentials) {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,127}$/.test(value.siteName) ||
      value.siteName.trim() !== value.siteName
    )
      throw new EloquaApiError(
        "provider_validation_error",
        "Eloqua requires one exact site name.",
        400,
      );
    if (
      !this.secret(value.clientId) ||
      !this.secret(value.clientSecret) ||
      !this.secret(value.refreshToken, 12_000)
    )
      throw new EloquaApiError(
        "credential_missing",
        "Valid encrypted Eloqua OAuth credentials are required.",
        401,
      );
    if (!this.id(value.contactId) || !this.id(value.campaignId))
      throw new EloquaApiError(
        "provider_validation_error",
        "Eloqua requires one exact numeric contact ID and campaign ID.",
        400,
      );
  }

  private approvedOrigin(value: unknown) {
    if (typeof value !== "string") return this.invalidOrigin();
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return this.invalidOrigin();
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/^(?:secure(?:\.p0[1-9])?|www02\.secure)\.eloqua\.com$/i.test(
        url.hostname,
      )
    )
      return this.invalidOrigin();
    return url.origin;
  }

  private invalidOrigin(): never {
    throw new EloquaApiError(
      "provider_validation_error",
      "Eloqua returned an unapproved API origin.",
      502,
    );
  }

  private exactId(value: unknown, expected: string, kind: string) {
    const actual =
      typeof value === "number"
        ? String(value)
        : typeof value === "string"
          ? value
          : "";
    if (actual !== expected)
      throw new EloquaApiError(
        "provider_validation_error",
        `Eloqua returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return actual;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new EloquaApiError(
        "provider_validation_error",
        `Eloqua returned an invalid ${label} result.`,
        502,
      );
    return value as JsonObject;
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }

  private secretValue(value: unknown, maximum: number) {
    return typeof value === "string" && this.secret(value, maximum)
      ? value
      : null;
  }

  private id(value: string) {
    return (
      /^[1-9][0-9]{0,15}$/.test(value) && Number.isSafeInteger(Number(value))
    );
  }

  private secret(value: string, maximum = 8_000) {
    return Boolean(value) && value.length <= maximum && !/[\r\n]/.test(value);
  }

  private safeCode(
    status: number,
    tokenRequest: boolean,
  ): MarketplaceConnectorSafeErrorCode {
    if (status === 401)
      return tokenRequest ? "token_refresh_failed" : "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 400) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
