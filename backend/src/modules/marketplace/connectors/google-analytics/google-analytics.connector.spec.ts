import {
  GOOGLE_ANALYTICS_OVERVIEW_BODY,
  GoogleAnalyticsApiAdapter,
  GoogleAnalyticsApiError,
} from "./google-analytics-api.adapter";
import {
  GOOGLE_ANALYTICS_CONNECTOR_MANIFEST,
  GOOGLE_ANALYTICS_SCOPES,
} from "./google-analytics.connector";

describe("Google Analytics connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the exact read-only scope and exposes only two read wrappers", () => {
    expect(GOOGLE_ANALYTICS_SCOPES).toEqual([
      "https://www.googleapis.com/auth/analytics.readonly",
    ]);
    expect(GOOGLE_ANALYTICS_CONNECTOR_MANIFEST.tools).toHaveLength(2);
    expect(
      GOOGLE_ANALYTICS_CONNECTOR_MANIFEST.tools.map((tool) => ({
        name: tool.functionName,
        action: tool.action,
        approval: tool.approvalRequired,
      })),
    ).toEqual([
      {
        name: "google_analytics_property_get",
        action: "read",
        approval: false,
      },
      {
        name: "google_analytics_overview_report",
        action: "read",
        approval: false,
      },
    ]);
  });

  it("reads only bounded safe metadata for the explicit GA4 property", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "properties/123456789",
          displayName: "Marketing GA4",
          timeZone: "Europe/London",
          currencyCode: "GBP",
          industryCategory: "TECHNOLOGY",
          propertyType: "PROPERTY_TYPE_ORDINARY",
          serviceLevel: "GOOGLE_ANALYTICS_STANDARD",
          account: "accounts/secret",
          dataRetentionSettings: { eventDataRetention: "secret" },
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleAnalyticsApiAdapter().getProperty("token", {
      propertyId: "123456789",
    });
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe(
      "https://analyticsadmin.googleapis.com/v1beta/properties/123456789",
    );
    expect(request.method).toBe("GET");
    expect(result).toMatchObject({
      semanticReadContract: "google-analytics-explicit-property-v1",
      explicitPropertyOnly: true,
      property: {
        name: "properties/123456789",
        displayName: "Marketing GA4",
        accountResourceReturned: false,
        dataStreamsReturned: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain("accounts/secret");
    expect(JSON.stringify(result)).not.toContain("dataRetentionSettings");
  });

  it("pins the aggregate report and returns at most twenty-five privacy-bounded rows", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      dimensionValues: [{ value: `Channel ${index}` }],
      metricValues: [
        { value: "4200" },
        { value: "5300" },
        { value: "4100" },
        { value: "0.7736" },
        { value: "28000" },
        { value: "210" },
        { value: "8140.25" },
      ],
      userId: "excluded",
      pagePath: "/excluded",
    }));
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          rows,
          rowCount: 30,
          propertyQuota: { tokensPerDay: { remaining: 1 } },
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleAnalyticsApiAdapter().getOverview("token", {
      propertyId: "123456789",
    });
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe(
      "https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport",
    );
    expect(JSON.parse(String(request.body))).toEqual(
      GOOGLE_ANALYTICS_OVERVIEW_BODY,
    );
    expect(result).toMatchObject({
      resultCount: 25,
      dateRange: "30daysAgo_to_yesterday",
      nextOffsetFollowed: false,
      arbitraryReportsEnabled: false,
      realtimeReportsEnabled: false,
      audienceExportsEnabled: false,
    });
    expect(result.rows).toHaveLength(25);
    expect(JSON.stringify(result)).not.toContain('"userId":"excluded"');
    expect(JSON.stringify(result)).not.toContain("pagePath");
    expect(JSON.stringify(result)).not.toContain("propertyQuota");
  });

  it("rejects property resource names and nonnumeric IDs before provider access", async () => {
    const fetch = jest.spyOn(global, "fetch");
    await expect(
      new GoogleAnalyticsApiAdapter().getOverview("token", {
        propertyId: "properties/123456789",
      }),
    ).rejects.toBeInstanceOf(GoogleAnalyticsApiError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
