import { CrazyEggApiAdapter, CrazyEggApiError } from "./crazy-egg-api.adapter";
import { CRAZY_EGG_CONNECTOR_MANIFEST } from "./crazy-egg.connector";

const credentials = { apiKey: "customer-site-api-key" };

describe("Crazy Egg connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated conversion write", () => {
    expect(
      CRAZY_EGG_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["write"]);
    expect(
      CRAZY_EGG_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["crazy_egg_conversions_record"]);
  });

  it("checks key presence without creating a synthetic conversion", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const result = await new CrazyEggApiAdapter().health(credentials);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      apiKeyPresent: true,
      liveVerificationPerformed: false,
      conversionCreated: false,
      analyticsReturned: false,
    });
  });

  it("records only a bounded documented conversion payload", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ private: "ignored" }), { status: 200 }),
      );
    const result = await new CrazyEggApiAdapter().recordConversions(
      credentials,
      {
        goalConversions: [
          {
            goalName: "Purchase",
            userIdentifier: "customer-123",
            url: "https://shop.example/thanks",
            value: 12.5,
            currency: "USD",
            country: "US",
            customData: { plan: "pro" },
          },
        ],
      },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://track.crazyegg.com/api/v1",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "key customer-site-api-key",
      }),
    });
    expect(result).toMatchObject({
      acceptedCount: 1,
      siteScopedApiKeyVerified: true,
      providerResponseReturned: false,
      visitorIdentifiersReturned: false,
      analyticsReturned: false,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects missing credentials, unsafe URLs, unsupported fields, and oversized batches", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new CrazyEggApiAdapter();
    await expect(adapter.health({ apiKey: "" })).rejects.toBeInstanceOf(
      CrazyEggApiError,
    );
    await expect(
      adapter.recordConversions(credentials, {
        goalConversions: [
          {
            goalName: "Goal",
            userIdentifier: "user",
            url: "http://unsafe.example",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(CrazyEggApiError);
    await expect(
      adapter.recordConversions(credentials, {
        goalConversions: [
          { goalName: "Goal", userIdentifier: "user", raw: true },
        ],
      }),
    ).rejects.toBeInstanceOf(CrazyEggApiError);
    await expect(
      adapter.recordConversions(credentials, {
        goalConversions: Array.from({ length: 26 }, () => ({
          goalName: "Goal",
          userIdentifier: "user",
        })),
      }),
    ).rejects.toBeInstanceOf(CrazyEggApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new CrazyEggApiAdapter().recordConversions(credentials, {
        goalConversions: [{ goalName: "Goal", userIdentifier: "user" }],
      }),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
