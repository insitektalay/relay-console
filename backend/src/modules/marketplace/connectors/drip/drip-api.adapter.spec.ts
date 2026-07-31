import { DripApiAdapter, type DripBoundaries } from "./drip-api.adapter";

const boundaries: DripBoundaries = {
  accountId: "123456",
  subscriberId: "sub_abc123",
  campaignId: "987654",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("DripApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses a fixed account/subscriber path and strips personal fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        subscribers: [
          {
            id: "sub_abc123",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
            email: "private@example.com",
            ip_address: "192.0.2.1",
            custom_fields: { private: "value" },
            tags: ["Customer"],
            lifetime_value: 9999,
          },
        ],
      }),
    );
    const result = await new DripApiAdapter().getSubscriberSummary(
      "access-token",
      boundaries,
    );
    expect(result).toEqual({
      subscriber: {
        id: "sub_abc123",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        personalFieldsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.getdrip.com/v2/123456/subscribers/sub_abc123",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer access-token");
  });

  it("projects only bounded Email Series Campaign metadata", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        campaigns: [
          {
            id: "987654",
            name: "Staging series",
            status: "draft",
            created_at: "2026-01-01T00:00:00Z",
            from_email: "private@example.com",
            bcc: "private@example.com",
            forms: [{ id: "123" }],
            links: { subscribers: "private" },
          },
        ],
        linked: { forms: [{ id: "123" }] },
      }),
    );
    await expect(
      new DripApiAdapter().getCampaignSummary("access-token", boundaries),
    ).resolves.toEqual({
      campaign: {
        id: "987654",
        name: "Staging series",
        status: "draft",
        createdAt: "2026-01-01T00:00:00Z",
        privateCampaignDetailsIncluded: false,
      },
    });
  });

  it("rejects an email selector before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new DripApiAdapter().getSubscriberSummary("access-token", {
        ...boundaries,
        subscriberId: "person@example.com",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps provider rate limits without exposing response content", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({ message: "secret provider detail" }, 429),
      );
    await expect(
      new DripApiAdapter().getCampaignSummary("access-token", boundaries),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
