import {
  MailercloudApiAdapter,
  type MailercloudCredentials,
} from "./mailercloud-api.adapter";
const credentials: MailercloudCredentials = {
  apiKey: "test-api-key",
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
describe("MailercloudApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses a fixed contact path and strips personal fields", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({
          data: {
            id: "contact_123",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
            email: "private@example.com",
            first_name: "Private",
            custom_fields: {},
            lists: [],
          },
        }),
      );
    await expect(
      new MailercloudApiAdapter().getContactSummary(credentials),
    ).resolves.toEqual({
      contact: {
        id: "contact_123",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        personalFieldsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://cloudapi.mailercloud.com/v1/contacts/contact_123",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("test-api-key");
  });
  it("projects bounded campaign metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({
          id: "campaign_456",
          status: "sent",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
          scheduled_at: null,
          sent_at: "2026-01-03T00:00:00Z",
          name: "Private",
          subject: "Private",
          content: "Private",
          audience: {},
          report: {},
        }),
      );
    await expect(
      new MailercloudApiAdapter().getCampaignSummary(credentials),
    ).resolves.toEqual({
      campaign: {
        id: "campaign_456",
        status: "sent",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        scheduledAt: null,
        sentAt: "2026-01-03T00:00:00Z",
        privateCampaignDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://cloudapi.mailercloud.com/v1/campaign/campaign_456",
    );
  });
  it("rejects email selectors before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new MailercloudApiAdapter().getContactSummary({
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
      .mockImplementation(() => json({ message: "private" }, 429));
    await expect(
      new MailercloudApiAdapter().getCampaignSummary(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
