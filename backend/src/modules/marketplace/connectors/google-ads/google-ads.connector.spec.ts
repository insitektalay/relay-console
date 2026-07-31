import {
  GOOGLE_ADS_CAMPAIGN_PERFORMANCE_QUERY,
  GOOGLE_ADS_CUSTOMER_SUMMARY_QUERY,
  GoogleAdsApiAdapter,
  GoogleAdsApiError,
} from "./google-ads-api.adapter";
import {
  GOOGLE_ADS_CONNECTOR_MANIFEST,
  GOOGLE_ADS_SCOPES,
} from "./google-ads.connector";

describe("Google Ads connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the exact Ads scope and exposes only two read-only wrappers", () => {
    expect(GOOGLE_ADS_SCOPES).toEqual([
      "https://www.googleapis.com/auth/adwords",
    ]);
    expect(GOOGLE_ADS_CONNECTOR_MANIFEST.tools).toHaveLength(2);
    expect(
      GOOGLE_ADS_CONNECTOR_MANIFEST.tools.map((tool) => ({
        name: tool.functionName,
        action: tool.action,
        approval: tool.approvalRequired,
      })),
    ).toEqual([
      {
        name: "google_ads_customer_summary_get",
        action: "read",
        approval: false,
      },
      {
        name: "google_ads_campaign_performance_report",
        action: "read",
        approval: false,
      },
    ]);
  });

  it("pins the customer summary query, headers, API version, and explicit customer", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              customer: {
                id: "1234567890",
                descriptiveName: "Example advertiser",
                currencyCode: "GBP",
                timeZone: "Europe/London",
                testAccount: false,
                manager: false,
                autoTaggingEnabled: true,
                resourceName: "customers/secret",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleAdsApiAdapter().getCustomerSummary(
      "access-token",
      "developer-token",
      { customerId: "1234567890" },
      "0987654321",
    );
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe(
      "https://googleads.googleapis.com/v24/customers/1234567890/googleAds:search",
    );
    expect(request.headers).toMatchObject({
      Authorization: "Bearer access-token",
      "developer-token": "developer-token",
      "login-customer-id": "0987654321",
    });
    expect(JSON.parse(String(request.body))).toEqual({
      query: GOOGLE_ADS_CUSTOMER_SUMMARY_QUERY,
    });
    expect(result).toMatchObject({
      semanticReadContract: "google-ads-explicit-customer-summary-v1",
      reportingOnly: true,
      explicitCustomerOnly: true,
      customer: {
        id: "1234567890",
        accountUsersReturned: false,
        hierarchyReturned: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain("resourceName");
  });

  it("returns at most fifty bounded campaign rows without following pagination", async () => {
    const results = Array.from({ length: 55 }, (_, index) => ({
      campaign: {
        id: String(index),
        name: `Campaign ${index}`,
        status: "ENABLED",
        advertisingChannelType: "SEARCH",
      },
      metrics: {
        impressions: "12500",
        clicks: "640",
        costMicros: "182500000",
        conversions: 48.5,
        conversionsValue: 8120,
      },
      segments: { date: "excluded" },
      searchTermView: { searchTerm: "excluded" },
    }));
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results, nextPageToken: "withheld" }), {
        status: 200,
      }),
    );
    const result = await new GoogleAdsApiAdapter().getCampaignPerformance(
      "access-token",
      "developer-token",
      { customerId: "1234567890" },
    );
    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(JSON.parse(String(request.body))).toEqual({
      query: GOOGLE_ADS_CAMPAIGN_PERFORMANCE_QUERY,
    });
    expect(result).toMatchObject({
      resultCount: 50,
      dateRange: "LAST_30_DAYS",
      nextPageTokenPresent: true,
      nextPageTokenFollowed: false,
      arbitraryGAQLEnabled: false,
      searchStreamEnabled: false,
      mutationsEnabled: false,
    });
    expect(result.campaigns).toHaveLength(50);
    expect(JSON.stringify(result)).not.toContain("withheld");
    expect(JSON.stringify(result)).not.toContain("searchTermView");
  });

  it("rejects non-canonical customer IDs before provider access", async () => {
    const fetch = jest.spyOn(global, "fetch");
    await expect(
      new GoogleAdsApiAdapter().getCampaignPerformance(
        "access-token",
        "developer-token",
        { customerId: "123-456-7890" },
      ),
    ).rejects.toBeInstanceOf(GoogleAdsApiError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
