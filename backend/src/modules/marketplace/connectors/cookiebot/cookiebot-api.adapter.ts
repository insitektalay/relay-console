import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type CookiebotCredentials = {
  apiKey: string;
  domainGroupId: string;
  domain: string;
};

export class CookiebotApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class CookiebotApiAdapter {
  async health(credentials: CookiebotCredentials) {
    return this.getCookieScanSummary(credentials);
  }

  async getRecentConsentSummary(credentials: CookiebotCredentials) {
    this.validate(credentials);
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    const path = `${this.prefix(credentials)}/domain/${encodeURIComponent(credentials.domain)}/consent/stats?startdate=${this.date(start)}&enddate=${this.date(end)}`;
    const value = await this.request(path);
    if (!this.isObject(value))
      throw new CookiebotApiError(
        "provider_validation_error",
        "Cookiebot returned an invalid consent summary.",
        502,
      );
    const consentstat = this.isObject(value.consentstat)
      ? value.consentstat
      : {};
    const rawDays = Array.isArray(consentstat.consentday)
      ? consentstat.consentday
      : [consentstat.consentday];
    const days = rawDays
      .filter((item): item is JsonObject => this.isObject(item))
      .slice(0, 7);
    const total = (key: string) =>
      days.reduce((sum, day) => sum + this.integer(day[key]), 0);
    return {
      domain: this.text(value.domain, 253),
      startDate: this.text(value.utcstartdate, 100),
      endDate: this.text(value.utcenddate, 100),
      dayCount: days.length,
      totals: {
        optIn: total("OptIn"),
        optOut: total("OptOut"),
        impliedOptIn: total("OptInImplied"),
        strictOptIn: total("OptInStrict"),
        preferencesOptIn: total("TypeOptInPref"),
        statisticsOptIn: total("TypeOptInStat"),
        marketingOptIn: total("TypeOptInMark"),
      },
      countryBreakdownIncluded: false,
    };
  }

  async getCookieScanSummary(credentials: CookiebotCredentials) {
    this.validate(credentials);
    const value = await this.request(
      `${this.prefix(credentials)}/default/domain/${encodeURIComponent(credentials.domain)}/cookies`,
    );
    if (!this.isObject(value))
      throw new CookiebotApiError(
        "provider_validation_error",
        "Cookiebot returned an invalid cookie scan.",
        502,
      );
    const cookies = Array.isArray(value.cookies)
      ? value.cookies
          .filter((item): item is JsonObject => this.isObject(item))
          .slice(0, 10_000)
      : [];
    const categoryCounts: Record<string, number> = {};
    for (const cookie of cookies) {
      const key = `category_${String(cookie.Category ?? "unknown").slice(0, 20)}`;
      categoryCounts[key] = (categoryCounts[key] ?? 0) + 1;
    }
    return {
      domain: this.text(value.domain, 253),
      scanDate: this.text(value.utcscandate, 100),
      culture: this.text(value.culture, 20),
      cookieCount: cookies.length,
      categoryCounts,
      thirdPartyCount: cookies.filter(
        (item) => this.integer(item.ThirdParty) === 1,
      ).length,
      secureCount: cookies.filter((item) => this.integer(item.Secure) === 1)
        .length,
      priorConsentEnabledCount: cookies.filter(
        (item) => this.integer(item.PriorConsentEnabled) === 1,
      ).length,
      detailedTrackerDataIncluded: false,
    };
  }

  private prefix(credentials: CookiebotCredentials) {
    return `/api/v1/${encodeURIComponent(credentials.apiKey)}/json/domaingroup/${encodeURIComponent(credentials.domainGroupId)}`;
  }
  private async request(path: string): Promise<unknown> {
    const url = new URL(path, "https://consent.cookiebot.com");
    if (
      url.origin !== "https://consent.cookiebot.com" ||
      !url.pathname.startsWith("/api/v1/")
    )
      throw new CookiebotApiError(
        "policy_blocked",
        "Cookiebot requests must stay on fixed data-API routes.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new CookiebotApiError(
        "provider_unavailable",
        "Cookiebot could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_000_000)
      throw new CookiebotApiError(
        "policy_blocked",
        "Cookiebot response exceeded the two-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new CookiebotApiError(
        this.safeCode(response.status),
        `Cookiebot returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private validate(credentials: CookiebotCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 8000 ||
      /[\r\n/]/.test(credentials.apiKey)
    )
      throw new CookiebotApiError(
        "credential_missing",
        "A valid encrypted Cookiebot API key is required.",
        401,
      );
    if (
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        credentials.domainGroupId,
      )
    )
      throw new CookiebotApiError(
        "provider_validation_error",
        "Cookiebot Domain Group ID must be one exact UUID-form CBID.",
        400,
      );
    if (
      !/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
        credentials.domain,
      )
    )
      throw new CookiebotApiError(
        "provider_validation_error",
        "Cookiebot domain must be one exact registered hostname.",
        400,
      );
  }
  private date(value: Date) {
    return value.toISOString().slice(0, 10).replace(/-/g, "");
  }
  private integer(value: unknown) {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : 0;
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  }
  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }
  private isObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
