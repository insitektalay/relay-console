import { AWeberApiAdapter, type AWeberBoundaries } from "./aweber-api.adapter";

const boundaries: AWeberBoundaries = {
  accountId: "123456",
  listId: "234567",
  subscriberId: "345678",
  campaignType: "b",
  campaignId: "456789",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("AWeberApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses a fixed subscriber path and strips personal fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        id: 345678,
        subscribed_at: "2026-01-01T00:00:00-00:00",
        email: "private@example.com",
        name: "Private Person",
        ip_address: "192.0.2.1",
        status: "subscribed",
        tags: ["private"],
        custom_fields: { private: "value" },
      }),
    );
    await expect(
      new AWeberApiAdapter().getSubscriberSummary("access-token", boundaries),
    ).resolves.toEqual({
      subscriber: {
        id: "345678",
        subscribedAt: "2026-01-01T00:00:00-00:00",
        personalFieldsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.aweber.com/1.0/accounts/123456/lists/234567/subscribers/345678",
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("Bearer access-token");
  });

  it("uses the selected campaign kind and projects bounded metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        id: 456789,
        campaign_type: "b",
        status: "sent",
        created_at: "2026-01-01T00:00:00-00:00",
        scheduled_at: "2026-01-02T00:00:00-00:00",
        sent_at: "2026-01-02T00:01:00-00:00",
        subject: "private",
        body_html: "private",
        total_sent: 1234,
      }),
    );
    await expect(
      new AWeberApiAdapter().getCampaignSummary("access-token", boundaries),
    ).resolves.toEqual({
      campaign: {
        id: "456789",
        campaignType: "b",
        status: "sent",
        createdAt: "2026-01-01T00:00:00-00:00",
        scheduledAt: "2026-01-02T00:00:00-00:00",
        sentAt: "2026-01-02T00:01:00-00:00",
        privateMessageDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.aweber.com/1.0/accounts/123456/lists/234567/campaigns/b456789",
    );
  });

  it("rejects an unsupported campaign type before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new AWeberApiAdapter().getCampaignSummary("access-token", {
        ...boundaries,
        campaignType: "automation",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a resource response outside the selected boundary", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        id: 999999,
        campaign_type: "b",
        status: "sent",
      }),
    );
    await expect(
      new AWeberApiAdapter().getCampaignSummary("access-token", boundaries),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 502,
    });
  });
});
