import {
  BenchmarkEmailApiAdapter,
  type BenchmarkEmailCredentials,
} from "./benchmark-email-api.adapter";

const credentials: BenchmarkEmailCredentials = {
  apiKey: `bme_us_${"a".repeat(43)}`,
  apiBaseUrl: "https://api-us-west-2-a.benchmarkemail.io",
  contactId: "contact_123",
  campaignId: "campaign_456",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("BenchmarkEmailApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the selected regional contact path and strips personal fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        _id: "contact_123",
        key: "private@example.com",
        fields: [{ value: "Private" }],
        status: { primary: "active" },
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
      }),
    );
    await expect(
      new BenchmarkEmailApiAdapter().getContactSummary(credentials),
    ).resolves.toEqual({
      contact: {
        id: "contact_123",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        personalFieldsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api-us-west-2-a.benchmarkemail.io/api/contact/contact_123",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)[
        "X-API-Key"
      ],
    ).toBe(credentials.apiKey);
  });

  it("projects bounded campaign lifecycle metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        _id: "campaign_456",
        status: "sent",
        subStatus: "private",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        scheduledAt: "2026-01-03T00:00:00Z",
        cancelledAt: null,
        previewImageUrl: "https://private.example/preview.png",
        sentCount: 20,
        failedCount: 1,
        totalRecipients: 21,
      }),
    );
    await expect(
      new BenchmarkEmailApiAdapter().getCampaignSummary(credentials),
    ).resolves.toEqual({
      campaign: {
        id: "campaign_456",
        status: "sent",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        scheduledAt: "2026-01-03T00:00:00Z",
        cancelledAt: null,
        privateCampaignDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api-us-west-2-a.benchmarkemail.io/api/email/campaign/campaign_456",
    );
  });

  it("rejects unapproved origins and email selectors before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new BenchmarkEmailApiAdapter().getContactSummary({
        ...credentials,
        apiBaseUrl: "https://example.com",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    await expect(
      new BenchmarkEmailApiAdapter().getContactSummary({
        ...credentials,
        contactId: "private@example.com",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps throttling without exposing provider content", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({ errors: [{ message: "private" }] }, 429),
      );
    await expect(
      new BenchmarkEmailApiAdapter().getCampaignSummary(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
