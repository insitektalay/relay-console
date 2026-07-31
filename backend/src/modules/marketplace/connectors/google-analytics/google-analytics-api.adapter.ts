import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export const GOOGLE_ANALYTICS_OVERVIEW_BODY = {
  dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
  dimensions: [{ name: "sessionDefaultChannelGroup" }],
  metrics: [
    { name: "activeUsers" },
    { name: "sessions" },
    { name: "engagedSessions" },
    { name: "engagementRate" },
    { name: "eventCount" },
    { name: "keyEvents" },
    { name: "totalRevenue" },
  ],
  orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  limit: "25",
  keepEmptyRows: false,
  returnPropertyQuota: true,
};

export class GoogleAnalyticsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleAnalyticsApiAdapter {
  private readonly adminOrigin = "https://analyticsadmin.googleapis.com/v1beta";
  private readonly dataOrigin = "https://analyticsdata.googleapis.com/v1beta";

  health(token: string) {
    this.token(token);
    return {
      readOnlyV1: true,
      explicitPropertyOnly: true,
      fixedReportsOnly: true,
      providerRequestCount: 0,
    };
  }

  async getProperty(token: string, input: JsonObject) {
    const propertyId = this.propertyId(input.propertyId);
    const value = await this.request(
      token,
      "GET",
      `${this.adminOrigin}/properties/${propertyId}`,
    );
    return {
      semanticReadContract: "google-analytics-explicit-property-v1",
      property: this.property(value),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getOverview(token: string, input: JsonObject) {
    const propertyId = this.propertyId(input.propertyId);
    const value = await this.request(
      token,
      "POST",
      `${this.dataOrigin}/properties/${propertyId}:runReport`,
      GOOGLE_ANALYTICS_OVERVIEW_BODY,
    );
    const rows = this.array(value.rows)
      .slice(0, 25)
      .map((entry) => this.row(entry));
    return {
      semanticReadContract: "google-analytics-fixed-overview-report-v1",
      rows,
      resultCount: rows.length,
      dateRange: "30daysAgo_to_yesterday",
      nextOffsetFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async request(
    token: string,
    method: "GET" | "POST",
    base: string,
    body?: JsonObject,
  ) {
    this.token(token);
    const url = new URL(base);
    const allowedAdmin =
      method === "GET" &&
      url.hostname === "analyticsadmin.googleapis.com" &&
      /^\/v1beta\/properties\/[0-9]{1,32}$/.test(url.pathname);
    const allowedData =
      method === "POST" &&
      url.hostname === "analyticsdata.googleapis.com" &&
      /^\/v1beta\/properties\/[0-9]{1,32}:runReport$/.test(url.pathname);
    if (url.protocol !== "https:" || (!allowedAdmin && !allowedData))
      throw new GoogleAnalyticsApiError(
        "provider_validation_error",
        "Google Analytics API URL is unsafe.",
      );
    if (
      allowedData &&
      JSON.stringify(body) !== JSON.stringify(GOOGLE_ANALYTICS_OVERVIEW_BODY)
    )
      throw new GoogleAnalyticsApiError(
        "provider_validation_error",
        "Only Relay's fixed Google Analytics overview report is allowed.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new GoogleAnalyticsApiError(
        "provider_unavailable",
        "Google Analytics API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1048576)
      throw new GoogleAnalyticsApiError(
        "provider_validation_error",
        "Google Analytics response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GoogleAnalyticsApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Google Analytics API rejected the bounded read request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleAnalyticsApiError(
        "provider_validation_error",
        "Google Analytics API returned invalid JSON.",
      );
    }
  }

  private property(value: unknown) {
    const record = this.object(value);
    return {
      name: this.scalar(record.name, 64),
      displayName: this.scalar(record.displayName, 256),
      timeZone: this.scalar(record.timeZone, 64),
      currencyCode: this.scalar(record.currencyCode, 3),
      industryCategory: this.scalar(record.industryCategory, 64),
      propertyType: this.scalar(record.propertyType, 64),
      serviceLevel: this.scalar(record.serviceLevel, 64),
      accountResourceReturned: false,
      dataStreamsReturned: false,
    };
  }

  private row(value: unknown) {
    const record = this.object(value);
    const dimensions = this.array(record.dimensionValues);
    const metrics = this.array(record.metricValues);
    const item = (values: unknown[], index: number) =>
      this.scalar(this.object(values[index]).value, 128);
    return {
      sessionDefaultChannelGroup: item(dimensions, 0),
      activeUsers: item(metrics, 0),
      sessions: item(metrics, 1),
      engagedSessions: item(metrics, 2),
      engagementRate: item(metrics, 3),
      eventCount: item(metrics, 4),
      keyEvents: item(metrics, 5),
      totalRevenue: item(metrics, 6),
      userIdentifiersReturned: false,
      demographicsInterestsReturned: false,
      pageSearchGeoCustomDetailReturned: false,
    };
  }

  private boundary() {
    return {
      readOnlyV1: true,
      explicitPropertyOnly: true,
      propertyDiscoveryEnabled: false,
      arbitraryReportsEnabled: false,
      realtimeReportsEnabled: false,
      audienceExportsEnabled: false,
      userLevelDetailReturned: false,
      mutationsEnabled: false,
      automaticPagination: false,
      rawProviderToolExposure: false,
    };
  }

  private token(value: string) {
    if (!value || value.length > 8000)
      throw new GoogleAnalyticsApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }

  private propertyId(value: unknown) {
    if (typeof value !== "string" || !/^[0-9]{1,32}$/.test(value))
      throw new GoogleAnalyticsApiError(
        "provider_validation_error",
        "propertyId must be a numeric GA4 property ID.",
      );
    return value;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private scalar(value: unknown, max: number) {
    if (typeof value === "string" && value.length <= max) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
}
