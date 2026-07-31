import {
  MailerLiteApiAdapter,
  type MailerLiteCredentials,
} from "./mailerlite-api.adapter";

const credentials: MailerLiteCredentials = {
  apiToken: "api-token",
  subscriberId: "31986843064993537",
  campaignId: "66200823885989563",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("MailerLiteApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses a fixed subscriber path and strips personal fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          id: "31986843064993537",
          created_at: "2026-01-01 00:00:00",
          updated_at: "2026-01-02 00:00:00",
          email: "private@example.com",
          status: "active",
          ip_address: "192.0.2.1",
          fields: { name: "Private" },
          groups: [{ id: "123" }],
          open_rate: 75,
        },
      }),
    );
    const result = await new MailerLiteApiAdapter().getSubscriberSummary(
      credentials,
    );
    expect(result).toEqual({
      subscriber: {
        id: "31986843064993537",
        createdAt: "2026-01-01 00:00:00",
        updatedAt: "2026-01-02 00:00:00",
        personalFieldsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://connect.mailerlite.com/api/subscribers/31986843064993537",
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("Bearer api-token");
    expect(headers["X-Version"]).toBe("2026-07-17");
  });

  it("projects only bounded campaign metadata", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          id: "66200823885989563",
          name: "Staging campaign",
          type: "regular",
          status: "draft",
          created_at: "2026-01-01 00:00:00",
          updated_at: "2026-01-02 00:00:00",
          emails: [{ subject: "private", from: "private@example.com" }],
          filter: [[{ args: ["groups", ["42"]] }]],
          settings: { track_opens: true },
        },
      }),
    );
    await expect(
      new MailerLiteApiAdapter().getCampaignSummary(credentials),
    ).resolves.toEqual({
      campaign: {
        id: "66200823885989563",
        name: "Staging campaign",
        type: "regular",
        status: "draft",
        createdAt: "2026-01-01 00:00:00",
        updatedAt: "2026-01-02 00:00:00",
        privateCampaignDetailsIncluded: false,
      },
    });
  });

  it("rejects an email selector before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new MailerLiteApiAdapter().getSubscriberSummary({
        ...credentials,
        subscriberId: "private@example.com",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps global rate limits without exposing provider content", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ message: "private detail" }, 429));
    await expect(
      new MailerLiteApiAdapter().getCampaignSummary(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
