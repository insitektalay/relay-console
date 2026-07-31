import {
  GoogleBusinessProfileApiAdapter,
  GoogleBusinessProfileApiError,
} from "./google-business-profile-api.adapter";
import {
  GOOGLE_BUSINESS_PROFILE_CONNECTOR_MANIFEST,
  GOOGLE_BUSINESS_PROFILE_SCOPES,
} from "./google-business-profile.connector";

describe("Google Business Profile connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses the exact provider scope but exposes only four reads", () => {
    expect(GOOGLE_BUSINESS_PROFILE_SCOPES).toEqual([
      "https://www.googleapis.com/auth/business.manage",
    ]);
    expect(
      GOOGLE_BUSINESS_PROFILE_CONNECTOR_MANIFEST.tools.map((tool) => [
        tool.functionName,
        tool.action,
      ]),
    ).toEqual([
      ["google_business_profile_account_get", "read"],
      ["google_business_profile_location_get", "read"],
      ["google_business_profile_performance_summary", "read"],
      ["google_business_profile_search_keywords_list", "read"],
    ]);
  });
  it("reads only masked location metadata and strips sensitive fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "locations/456",
          title: "Relay Cafe",
          storeCode: "LON",
          websiteUri: "https://example.com",
          phoneNumbers: {
            primaryPhone: "+44123",
            additionalPhones: ["excluded"],
          },
          categories: {
            primaryCategory: { name: "gcid:cafe", displayName: "Cafe" },
          },
          metadata: {
            mapsUri: "https://maps.google.com/x",
            newReviewUri: "https://g.page/r/x",
            placeId: "excluded",
          },
          storefrontAddress: { postalCode: "excluded" },
          latlng: { latitude: 1 },
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleBusinessProfileApiAdapter().getLocation(
      "token",
      { locationName: "locations/456" },
    );
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [URL];
    expect(url.searchParams.get("readMask")).toContain("regularHours");
    expect(result).toMatchObject({
      location: {
        name: "locations/456",
        title: "Relay Cafe",
        primaryPhone: "+44123",
        placeIdReturned: false,
        addressReturned: false,
      },
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("postalCode");
    expect(JSON.stringify(result)).not.toContain("additionalPhones");
  });
  it("pins seven daily metrics to thirty complete days", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          multiDailyMetricTimeSeries: [
            {
              dailyMetric: "CALL_CLICKS",
              timeSeries: {
                datedValues: [
                  { date: { year: 2026, month: 6, day: 30 }, value: "4" },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleBusinessProfileApiAdapter().getPerformance(
      "token",
      { locationName: "locations/456" },
      new Date("2026-07-17T12:00:00Z"),
    );
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [URL];
    expect(url.searchParams.getAll("dailyMetrics")).toHaveLength(7);
    expect(result).toMatchObject({
      dateRange: { startDate: "2026-06-17", endDate: "2026-07-16" },
      timeSeries: [
        {
          dailyMetric: "CALL_CLICKS",
          datedValues: [{ date: "2026-06-30", value: "4" }],
        },
      ],
      arbitraryMetricsEnabled: false,
    });
  });
  it("returns only the first twenty keyword rows and never follows nextPageToken", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          searchKeywordsCounts: Array.from({ length: 20 }, (_, i) => ({
            searchKeyword: `term ${i}`,
            insightsValue: { value: String(i) },
          })),
          nextPageToken: "excluded",
        }),
        { status: 200 },
      ),
    );
    const result =
      await new GoogleBusinessProfileApiAdapter().listSearchKeywords(
        "token",
        { locationName: "locations/456" },
        new Date("2026-07-17T12:00:00Z"),
      );
    expect(result).toMatchObject({
      monthlyRange: { startMonth: "2026-04", endMonth: "2026-06" },
      resultCount: 20,
      truncated: true,
      nextPageTokenFollowed: false,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('"nextPageToken":"excluded"');
  });
  it("rejects unbound resource shapes before provider access", async () => {
    const fetch = jest.spyOn(global, "fetch");
    await expect(
      new GoogleBusinessProfileApiAdapter().getLocation("token", {
        locationName: "accounts/1/locations/2",
      }),
    ).rejects.toBeInstanceOf(GoogleBusinessProfileApiError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
