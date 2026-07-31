import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type ZohoExpenseCredentials = {
  accessToken: string;
  apiOrigin: string;
  organizationId: string;
};
export class ZohoExpenseApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}
@Injectable()
export class ZohoExpenseApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}
  async health(credentials: ZohoExpenseCredentials) {
    const result = await this.getOrganization(credentials);
    return {
      organizationId: result.organization.organizationId,
      reachable: true,
    };
  }
  async getOrganization(credentials: ZohoExpenseCredentials) {
    const validated = this.credentials(credentials);
    const response = await this.get(validated);
    const organizations = Array.isArray(response.organizations)
      ? response.organizations
      : [];
    const exact = organizations
      .map((row) => this.object(row))
      .find(
        (row) => this.text(row.organization_id) === validated.organizationId,
      );
    if (!exact)
      throw new ZohoExpenseApiError(
        "provider_validation_error",
        "Zoho Expense did not return the exact consent-bound organization.",
      );
    return { organization: this.organization(exact), nextPageFollowed: false };
  }
  private async get(
    credentials: ReturnType<ZohoExpenseApiAdapter["credentials"]>,
  ) {
    let response: Response;
    try {
      response = await this.request(
        `${credentials.apiOrigin}/expense/v1/organizations`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Zoho-oauthtoken ${credentials.accessToken}`,
            "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
          },
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
        },
      );
    } catch {
      throw new ZohoExpenseApiError(
        "provider_unavailable",
        "Zoho Expense is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new ZohoExpenseApiError(
        "provider_validation_error",
        "Zoho Expense response exceeded the safe size limit.",
      );
    if (!response.ok)
      throw new ZohoExpenseApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Zoho Expense API request failed.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new ZohoExpenseApiError(
        "provider_validation_error",
        "Zoho Expense returned an invalid response.",
      );
    }
  }
  private credentials(credentials: ZohoExpenseCredentials) {
    const accessToken = credentials.accessToken.trim();
    const organizationId = credentials.organizationId.trim();
    let apiOrigin = "";
    try {
      const url = new URL(credentials.apiOrigin);
      apiOrigin = url.origin;
      if (
        url.protocol !== "https:" ||
        url.origin !== credentials.apiOrigin ||
        !/^www\.zohoapis\.(com|eu|in|com\.au|jp|ca|com\.cn|ae|sa|uk)$/.test(
          url.hostname,
        )
      )
        throw new Error();
    } catch {
      throw new ZohoExpenseApiError(
        "provider_validation_error",
        "Zoho Expense regional API origin is invalid.",
      );
    }
    if (!accessToken || accessToken.length > 16_384)
      throw new ZohoExpenseApiError(
        "credential_missing",
        "Zoho Expense OAuth credentials are missing or invalid.",
      );
    if (!/^[1-9][0-9]{0,19}$/.test(organizationId))
      throw new ZohoExpenseApiError(
        "provider_validation_error",
        "A valid exact Zoho Expense organization binding is required.",
      );
    return { accessToken, apiOrigin, organizationId };
  }
  private organization(row: JsonObject) {
    return {
      organizationId: this.text(row.organization_id),
      name: this.text(row.name),
      isDefaultOrg: Boolean(row.is_default_org),
      planName: this.text(row.plan_name),
      languageCode: this.text(row.language_code),
      fiscalYearStartMonth: this.scalar(row.fiscal_year_start_month),
      timeZone: this.text(row.time_zone),
      isOrgActive: Boolean(row.is_org_active),
      currencyCode: this.text(row.currency_code),
      pricePrecision: this.scalar(row.price_precision),
    };
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private text(value: unknown) {
    return typeof value === "string" || typeof value === "number"
      ? String(value).trim().slice(0, 500)
      : "";
  }
  private scalar(value: unknown) {
    return typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
      ? value
      : null;
  }
}
