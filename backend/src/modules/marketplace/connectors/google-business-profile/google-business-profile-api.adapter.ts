import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
const LOCATION_READ_MASK =
  "name,title,storeCode,websiteUri,phoneNumbers,categories,regularHours,openInfo,metadata";
const DAILY_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
];

export class GoogleBusinessProfileApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleBusinessProfileApiAdapter {
  health(token: string) {
    this.token(token);
    return {
      readOnlyV1: true,
      boundLocationOnly: true,
      providerScopeCanWrite: true,
      writesEnabled: false,
      providerRequestCount: 0,
    };
  }

  async getAccount(token: string, input: JsonObject) {
    const accountName = this.accountName(input.accountName);
    const value = await this.request(
      token,
      new URL(
        `https://mybusinessaccountmanagement.googleapis.com/v1/${accountName}`,
      ),
    );
    return {
      semanticReadContract: "google-business-profile-bound-account-v1",
      account: this.account(value, accountName),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getLocation(token: string, input: JsonObject) {
    const locationName = this.locationName(input.locationName);
    const url = new URL(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}`,
    );
    url.searchParams.set("readMask", LOCATION_READ_MASK);
    const value = await this.request(token, url);
    return {
      semanticReadContract: "google-business-profile-bound-location-v1",
      location: this.location(value, locationName),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getPerformance(token: string, input: JsonObject, now = new Date()) {
    const locationName = this.locationName(input.locationName);
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
    );
    const start = new Date(end.getTime() - 29 * 86400000);
    const url = new URL(
      `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries`,
    );
    for (const metric of DAILY_METRICS)
      url.searchParams.append("dailyMetrics", metric);
    this.dateParams(url, "dailyRange.startDate", start);
    this.dateParams(url, "dailyRange.endDate", end);
    const value = await this.request(token, url);
    const series = this.array(value.multiDailyMetricTimeSeries)
      .slice(0, DAILY_METRICS.length)
      .map((entry) => this.metricSeries(entry));
    return {
      semanticReadContract: "google-business-profile-fixed-performance-v1",
      locationName,
      dateRange: { startDate: this.isoDate(start), endDate: this.isoDate(end) },
      metrics: DAILY_METRICS,
      timeSeries: series,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async listSearchKeywords(token: string, input: JsonObject, now = new Date()) {
    const locationName = this.locationName(input.locationName);
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 2, 1),
    );
    const url = new URL(
      `https://businessprofileperformance.googleapis.com/v1/${locationName}/searchkeywords/impressions/monthly`,
    );
    url.searchParams.set(
      "monthlyRange.startMonth.year",
      String(start.getUTCFullYear()),
    );
    url.searchParams.set(
      "monthlyRange.startMonth.month",
      String(start.getUTCMonth() + 1),
    );
    url.searchParams.set(
      "monthlyRange.endMonth.year",
      String(end.getUTCFullYear()),
    );
    url.searchParams.set(
      "monthlyRange.endMonth.month",
      String(end.getUTCMonth() + 1),
    );
    url.searchParams.set("pageSize", "20");
    const value = await this.request(token, url);
    const all = this.array(value.searchKeywordsCounts);
    const keywords = all.slice(0, 20).map((entry) => {
      const item = this.object(entry);
      const insight = this.object(item.insightsValue);
      return {
        searchKeyword: this.scalar(item.searchKeyword, 256),
        value: this.intString(insight.value),
        threshold: this.intString(insight.threshold),
        redactionStatus: "aggregate-performance-only",
      };
    });
    return {
      semanticReadContract: "google-business-profile-fixed-keywords-v1",
      locationName,
      monthlyRange: {
        startMonth: this.month(start),
        endMonth: this.month(end),
      },
      keywords,
      resultCount: keywords.length,
      truncated: Boolean(value.nextPageToken) || all.length > 20,
      nextPageTokenFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async request(token: string, url: URL) {
    this.token(token);
    const path = url.pathname;
    const account =
      url.hostname === "mybusinessaccountmanagement.googleapis.com" &&
      /^\/v1\/accounts\/[0-9]+$/.test(path) &&
      !url.search;
    const location =
      url.hostname === "mybusinessbusinessinformation.googleapis.com" &&
      /^\/v1\/locations\/[0-9]+$/.test(path) &&
      url.searchParams.get("readMask") === LOCATION_READ_MASK &&
      [...url.searchParams].length === 1;
    const performance =
      url.hostname === "businessprofileperformance.googleapis.com" &&
      (/^\/v1\/locations\/[0-9]+:fetchMultiDailyMetricsTimeSeries$/.test(
        path,
      ) ||
        /^\/v1\/locations\/[0-9]+\/searchkeywords\/impressions\/monthly$/.test(
          path,
        ));
    if (
      url.protocol !== "https:" ||
      (!account && !location && !performance) ||
      url.searchParams.has("pageToken")
    )
      throw new GoogleBusinessProfileApiError(
        "provider_validation_error",
        "Google Business Profile API URL is unsafe.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new GoogleBusinessProfileApiError(
        "provider_unavailable",
        "Google Business Profile API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1048576)
      throw new GoogleBusinessProfileApiError(
        "provider_validation_error",
        "Google Business Profile response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GoogleBusinessProfileApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Google Business Profile API rejected the bounded read request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleBusinessProfileApiError(
        "provider_validation_error",
        "Google Business Profile API returned invalid JSON.",
      );
    }
  }

  private account(value: unknown, expected: string) {
    const item = this.object(value);
    return {
      name: this.exact(item.name, expected),
      accountName: this.scalar(item.accountName, 256),
      type: this.scalar(item.type, 64),
      role: this.scalar(item.role, 64),
      verificationState: this.scalar(item.verificationState, 64),
      vettedState: this.scalar(item.vettedState, 64),
      permissionLevel: this.scalar(item.permissionLevel, 64),
      primaryOwnerReturned: false,
      organizationContactReturned: false,
      redactionStatus: "private-state-excluded",
    };
  }
  private location(value: unknown, expected: string) {
    const item = this.object(value);
    const phones = this.object(item.phoneNumbers);
    const categories = this.object(item.categories);
    const primary = this.object(categories.primaryCategory);
    const metadata = this.object(item.metadata);
    return {
      name: this.exact(item.name, expected),
      title: this.scalar(item.title, 256),
      storeCode: this.scalar(item.storeCode, 128),
      websiteUri: this.scalar(item.websiteUri, 2048),
      primaryPhone: this.scalar(phones.primaryPhone, 64),
      primaryCategory: {
        name: this.scalar(primary.name, 128),
        displayName: this.scalar(primary.displayName, 256),
      },
      regularHours: this.hours(item.regularHours),
      openInfo: this.safeObject(item.openInfo, ["status", "canReopen"]),
      mapsUri: this.scalar(metadata.mapsUri, 2048),
      newReviewUri: this.scalar(metadata.newReviewUri, 2048),
      placeIdReturned: false,
      latLngReturned: false,
      addressReturned: false,
      serviceAreaReturned: false,
      profileDescriptionReturned: false,
      redactionStatus: "private-state-excluded",
    };
  }
  private metricSeries(value: unknown) {
    const item = this.object(value);
    const dailyMetric = this.scalar(item.dailyMetric, 128);
    const series = this.object(item.timeSeries);
    return {
      dailyMetric,
      datedValues: this.array(series.datedValues)
        .slice(0, 31)
        .map((entry) => {
          const point = this.object(entry);
          const date = this.object(point.date);
          return {
            date: `${this.number(date.year, 0)}-${String(this.number(date.month, 0)).padStart(2, "0")}-${String(this.number(date.day, 0)).padStart(2, "0")}`,
            value: this.intString(point.value),
          };
        }),
    };
  }
  private hours(value: unknown) {
    const record = this.object(value);
    return {
      periods: this.array(record.periods)
        .slice(0, 14)
        .map((entry) =>
          this.safeObject(entry, [
            "openDay",
            "openTime",
            "closeDay",
            "closeTime",
          ]),
        ),
    };
  }
  private boundary() {
    return {
      readOnlyV1: true,
      exactAccountAndLocationOnly: true,
      providerScopeCanWrite: true,
      writesEnabled: false,
      accountDiscoveryEnabled: false,
      locationDiscoveryEnabled: false,
      arbitraryMetricsEnabled: false,
      reviewOrPostAccessEnabled: false,
      automaticPagination: false,
      rawProviderToolExposure: false,
      serviceAccountsEnabled: false,
      delegationEnabled: false,
      redactionStatus: "private-state-excluded",
    };
  }
  private accountName(value: unknown) {
    if (typeof value !== "string" || !/^accounts\/[0-9]{1,32}$/.test(value))
      throw new GoogleBusinessProfileApiError(
        "provider_validation_error",
        "accountName must be a bound accounts/{id} resource.",
      );
    return value;
  }
  private locationName(value: unknown) {
    if (typeof value !== "string" || !/^locations\/[0-9]{1,32}$/.test(value))
      throw new GoogleBusinessProfileApiError(
        "provider_validation_error",
        "locationName must be a bound locations/{id} resource.",
      );
    return value;
  }
  private dateParams(url: URL, prefix: string, date: Date) {
    url.searchParams.set(`${prefix}.year`, String(date.getUTCFullYear()));
    url.searchParams.set(`${prefix}.month`, String(date.getUTCMonth() + 1));
    url.searchParams.set(`${prefix}.day`, String(date.getUTCDate()));
  }
  private isoDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }
  private month(value: Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  private token(value: string) {
    if (!value || value.length > 8000)
      throw new GoogleBusinessProfileApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }
  private exact(value: unknown, expected: string) {
    return value === expected ? expected : null;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private scalar(
    value: unknown,
    max: number,
  ): string | number | boolean | null {
    if (typeof value === "string" && value.length <= max) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
  private intString(value: unknown) {
    return typeof value === "string" && /^\d{1,20}$/.test(value) ? value : null;
  }
  private number(value: unknown, fallback: number) {
    return typeof value === "number" && Number.isInteger(value)
      ? value
      : fallback;
  }
  private safeObject(value: unknown, keys: string[]) {
    const record = this.object(value);
    return Object.fromEntries(
      keys.map((key) => [key, this.scalar(record[key], 128)]),
    );
  }
}
