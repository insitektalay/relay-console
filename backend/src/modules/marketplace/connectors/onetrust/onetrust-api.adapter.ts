import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type OneTrustCredentials = {
  tenantHost: string;
  clientId: string;
  clientSecret: string;
  domainId: string;
  scanId: string;
};
export class OneTrustApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class OneTrustApiAdapter {
  async health(credentials: OneTrustCredentials) {
    return this.getDomainBrandingSummary(credentials);
  }

  async getDomainBrandingSummary(credentials: OneTrustCredentials) {
    await this.authorizedGet(
      credentials,
      `/api/cmp/v1/domains/${credentials.domainId}/branding-attributes`,
    );
    return {
      domain: {
        id: credentials.domainId,
        brandingAttributesAvailable: true,
        privateBrandingContentIncluded: false,
      },
    };
  }

  async getScanSummary(credentials: OneTrustCredentials) {
    const value = await this.authorizedGet(
      credentials,
      `/api/cmp/v1/webscans/domains/${credentials.domainId}/scans/${credentials.scanId}/summary`,
    );
    const row = this.object(value);
    return {
      scan: {
        domainId: credentials.domainId,
        scanId: credentials.scanId,
        status: this.pickText(row, ["status", "scanStatus", "state"], 100),
        startedAt: this.pickText(
          row,
          ["startedAt", "startDate", "scanStartDate"],
          100,
        ),
        completedAt: this.pickText(
          row,
          ["completedAt", "endDate", "scanEndDate"],
          100,
        ),
        cookieCount: this.count(row, [
          "cookieCount",
          "totalCookies",
          "cookies",
        ]),
        tagCount: this.count(row, ["tagCount", "totalTags", "tags"]),
        formCount: this.count(row, ["formCount", "totalForms", "forms"]),
        otherCount: this.count(row, ["otherCount", "totalOther", "other"]),
        detailedFindingsIncluded: false,
      },
    };
  }

  private async authorizedGet(
    credentials: OneTrustCredentials,
    path: string,
  ): Promise<unknown> {
    this.validate(credentials);
    const token = await this.token(credentials);
    return this.request(credentials.tenantHost, path, {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    });
  }

  private async token(credentials: OneTrustCredentials) {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }).toString();
    const value = await this.request(
      credentials.tenantHost,
      "/api/access/v1/oauth/token",
      {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      { method: "POST", body },
    );
    const row = this.object(value);
    const token =
      typeof row.access_token === "string"
        ? row.access_token
        : typeof row.accessToken === "string"
          ? row.accessToken
          : "";
    if (!token || token.length > 16_000 || /[\r\n]/.test(token))
      throw new OneTrustApiError(
        "credential_missing",
        "OneTrust did not return a valid access token.",
        401,
      );
    return token;
  }

  private async request(
    host: string,
    path: string,
    headers: Record<string, string>,
    override: { method: "POST"; body: string } | null = null,
  ): Promise<unknown> {
    const url = new URL(`https://${host}${path}`);
    if (
      url.hostname !== host ||
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".onetrust.com")
    )
      throw new OneTrustApiError(
        "policy_blocked",
        "OneTrust requests must stay on the configured tenant origin.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: override?.method ?? "GET",
        body: override?.body,
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new OneTrustApiError(
        "provider_unavailable",
        "OneTrust could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new OneTrustApiError(
        "policy_blocked",
        "OneTrust response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new OneTrustApiError(
        this.safeCode(response.status),
        `OneTrust returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private validate(value: OneTrustCredentials) {
    if (
      !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.onetrust\.com$/.test(
        value.tenantHost,
      ) ||
      value.tenantHost.includes("..")
    )
      throw new OneTrustApiError(
        "provider_validation_error",
        "OneTrust tenant must be one exact onetrust.com hostname.",
        400,
      );
    if (!this.secret(value.clientId) || !this.secret(value.clientSecret))
      throw new OneTrustApiError(
        "credential_missing",
        "Valid encrypted OneTrust client credentials are required.",
        401,
      );
    if (!this.uuid(value.domainId) || !this.uuid(value.scanId))
      throw new OneTrustApiError(
        "provider_validation_error",
        "OneTrust domain and scan IDs must be exact UUIDs.",
        400,
      );
  }
  private object(value: unknown): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new OneTrustApiError(
        "provider_validation_error",
        "OneTrust returned an invalid bounded result.",
        502,
      );
    return value as JsonObject;
  }
  private pickText(row: JsonObject, keys: string[], max: number) {
    for (const key of keys)
      if (typeof row[key] === "string") return row[key].slice(0, max);
    return null;
  }
  private count(row: JsonObject, keys: string[]) {
    for (const key of keys) {
      const value = row[key];
      if (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0
      )
        return value;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nested = value as JsonObject;
        for (const nestedKey of ["count", "total", "totalElements"])
          if (
            typeof nested[nestedKey] === "number" &&
            Number.isSafeInteger(nested[nestedKey]) &&
            Number(nested[nestedKey]) >= 0
          )
            return nested[nestedKey];
      }
    }
    return null;
  }
  private secret(value: string) {
    return Boolean(value) && value.length <= 8000 && !/[\r\n]/.test(value);
  }
  private uuid(value: string) {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      value,
    );
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
