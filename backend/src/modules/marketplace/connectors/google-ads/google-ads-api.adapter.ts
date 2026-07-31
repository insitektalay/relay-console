import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export const GOOGLE_ADS_CUSTOMER_SUMMARY_QUERY =
  "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.test_account, customer.manager, customer.auto_tagging_enabled FROM customer LIMIT 1";
export const GOOGLE_ADS_CAMPAIGN_PERFORMANCE_QUERY =
  "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date DURING LAST_30_DAYS AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 50";

export class GoogleAdsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleAdsApiAdapter {
  private readonly origin = "https://googleads.googleapis.com/v24";

  health(accessToken: string, developerToken: string) {
    this.accessToken(accessToken);
    this.developerToken(developerToken);
    return {
      reportingOnly: true,
      explicitCustomerOnly: true,
      fixedQueriesOnly: true,
      providerRequestCount: 0,
    };
  }

  async getCustomerSummary(
    accessToken: string,
    developerToken: string,
    input: JsonObject,
    loginCustomerId?: string | null,
  ) {
    const customerId = this.customerId(input.customerId);
    const value = await this.search(
      accessToken,
      developerToken,
      customerId,
      GOOGLE_ADS_CUSTOMER_SUMMARY_QUERY,
      loginCustomerId,
    );
    const row = this.object(this.array(value.results)[0]);
    const customer = this.object(row.customer);
    return {
      semanticReadContract: "google-ads-explicit-customer-summary-v1",
      customer: {
        id: this.scalar(customer.id, 10),
        descriptiveName: this.scalar(customer.descriptiveName, 256),
        currencyCode: this.scalar(customer.currencyCode, 3),
        timeZone: this.scalar(customer.timeZone, 64),
        testAccount: this.scalar(customer.testAccount, 8),
        manager: this.scalar(customer.manager, 8),
        autoTaggingEnabled: this.scalar(customer.autoTaggingEnabled, 8),
        accountUsersReturned: false,
        hierarchyReturned: false,
      },
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getCampaignPerformance(
    accessToken: string,
    developerToken: string,
    input: JsonObject,
    loginCustomerId?: string | null,
  ) {
    const customerId = this.customerId(input.customerId);
    const value = await this.search(
      accessToken,
      developerToken,
      customerId,
      GOOGLE_ADS_CAMPAIGN_PERFORMANCE_QUERY,
      loginCustomerId,
    );
    const campaigns = this.array(value.results)
      .slice(0, 50)
      .map((value) => {
        const row = this.object(value);
        const campaign = this.object(row.campaign);
        const metrics = this.object(row.metrics);
        return {
          id: this.scalar(campaign.id, 32),
          name: this.scalar(campaign.name, 256),
          status: this.scalar(campaign.status, 32),
          advertisingChannelType: this.scalar(
            campaign.advertisingChannelType,
            64,
          ),
          impressions: this.scalar(metrics.impressions, 32),
          clicks: this.scalar(metrics.clicks, 32),
          costMicros: this.scalar(metrics.costMicros, 32),
          conversions: this.scalar(metrics.conversions, 32),
          conversionValue: this.scalar(metrics.conversionsValue, 32),
          searchTermsReturned: false,
          clickIdentifiersReturned: false,
          audiencesReturned: false,
        };
      });
    return {
      semanticReadContract: "google-ads-bounded-campaign-performance-v1",
      campaigns,
      resultCount: campaigns.length,
      dateRange: "LAST_30_DAYS",
      nextPageTokenPresent: Boolean(this.text(value.nextPageToken, 2048)),
      nextPageTokenFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async search(
    accessToken: string,
    developerToken: string,
    customerId: string,
    query: string,
    loginCustomerId?: string | null,
  ) {
    this.accessToken(accessToken);
    this.developerToken(developerToken);
    if (
      query !== GOOGLE_ADS_CUSTOMER_SUMMARY_QUERY &&
      query !== GOOGLE_ADS_CAMPAIGN_PERFORMANCE_QUERY
    )
      throw new GoogleAdsApiError(
        "provider_validation_error",
        "Only Relay's fixed Google Ads reporting queries are allowed.",
      );
    const url = new URL(
      `${this.origin}/customers/${customerId}/googleAds:search`,
    );
    if (
      url.protocol !== "https:" ||
      url.hostname !== "googleads.googleapis.com" ||
      !/^\/v24\/customers\/[0-9]{10}\/googleAds:search$/.test(url.pathname)
    )
      throw new GoogleAdsApiError(
        "provider_validation_error",
        "Google Ads API URL is unsafe.",
      );
    const login = loginCustomerId ? this.customerId(loginCustomerId) : null;
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "developer-token": developerToken,
          ...(login ? { "login-customer-id": login } : {}),
        },
        body: JSON.stringify({ query }),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new GoogleAdsApiError(
        "provider_unavailable",
        "Google Ads API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1048576)
      throw new GoogleAdsApiError(
        "provider_validation_error",
        "Google Ads response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GoogleAdsApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Google Ads API rejected the bounded reporting request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleAdsApiError(
        "provider_validation_error",
        "Google Ads API returned invalid JSON.",
      );
    }
  }

  private boundary() {
    return {
      reportingOnly: true,
      explicitCustomerOnly: true,
      arbitraryGAQLEnabled: false,
      searchStreamEnabled: false,
      accountDiscoveryEnabled: false,
      mutationsEnabled: false,
      audiencesReturned: false,
      searchTermsReturned: false,
      clickIdentifiersReturned: false,
      billingReturned: false,
      automaticPagination: false,
      rawProviderToolExposure: false,
    };
  }

  private accessToken(value: string) {
    if (!value || value.length > 8000)
      throw new GoogleAdsApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }

  private developerToken(value: string) {
    if (!value || value.length > 256)
      throw new GoogleAdsApiError(
        "credential_missing",
        "A Railway-held Google Ads developer token is required.",
        401,
      );
  }

  private customerId(value: unknown) {
    if (typeof value !== "string" || !/^[0-9]{10}$/.test(value))
      throw new GoogleAdsApiError(
        "provider_validation_error",
        "customerId must contain exactly ten digits without hyphens.",
      );
    return value;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" && value.length <= max ? value : null;
  }

  private scalar(value: unknown, max: number) {
    if (typeof value === "string" && value.length <= max) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
}
