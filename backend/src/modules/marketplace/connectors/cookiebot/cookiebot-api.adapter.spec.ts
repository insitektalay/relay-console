import {
  CookiebotApiAdapter,
  CookiebotApiError,
} from "./cookiebot-api.adapter";

const credentials = {
  apiKey: "secret-key",
  domainGroupId: "12345678-1234-1234-1234-123456789abc",
  domain: "www.example.com",
};
describe("CookiebotApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("returns cookie aggregates without tracker detail", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            domain: "www.example.com",
            utcscandate: "2026-07-01T00:00:00Z",
            culture: "en",
            cookies: [
              {
                Name: "private-cookie",
                Value: "private-value",
                Provider: "tracker.example",
                FirstURL: "https://private.example",
                InitiatorSourceDomainIP: "192.0.2.1",
                Category: "1",
                ThirdParty: "0",
                Secure: "1",
                PriorConsentEnabled: "1",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new CookiebotApiAdapter().getCookieScanSummary(
      credentials,
    );
    expect(result).toEqual({
      domain: "www.example.com",
      scanDate: "2026-07-01T00:00:00Z",
      culture: "en",
      cookieCount: 1,
      categoryCounts: { category_1: 1 },
      thirdPartyCount: 0,
      secureCount: 1,
      priorConsentEnabledCount: 1,
      detailedTrackerDataIncluded: false,
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/default/domain/www.example.com/cookies",
    );
    expect(JSON.stringify(result)).not.toMatch(
      /private-cookie|private-value|tracker\.example|192\.0\.2\.1/i,
    );
  });
  it("rejects an unbounded domain before a provider call", async () => {
    await expect(
      new CookiebotApiAdapter().getRecentConsentSummary({
        ...credentials,
        domain: "*",
      }),
    ).rejects.toMatchObject<Partial<CookiebotApiError>>({
      code: "provider_validation_error",
    });
  });
});
