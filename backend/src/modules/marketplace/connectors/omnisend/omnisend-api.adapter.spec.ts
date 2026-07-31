import {
  OmnisendApiAdapter,
  type OmnisendBoundaries,
} from "./omnisend-api.adapter";
const boundaries: OmnisendBoundaries = {
  contactId: "000000000000000000000001",
  campaignId: "000000000000000000000002",
};
function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
describe("OmnisendApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses a fixed contact path and strips personal fields", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({
          id: boundaries.contactId,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
          identifiers: [{ type: "email", id: "private@example.com" }],
          firstName: "Private",
          customProperties: {},
          tags: [],
        }),
      );
    await expect(
      new OmnisendApiAdapter().getContactSummary("access-token", boundaries),
    ).resolves.toEqual({
      contact: {
        id: boundaries.contactId,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        personalFieldsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `https://api.omnisend.com/api/contacts/${boundaries.contactId}`,
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("Bearer access-token");
    expect(headers["Omnisend-Version"]).toBe("2026-03-15");
  });
  it("projects bounded campaign lifecycle metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({
          id: boundaries.campaignId,
          type: "regular",
          channel: "email",
          status: "sent",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
          scheduledAt: null,
          sentAt: "2026-01-03T00:00:00Z",
          name: "Private",
          content: {},
          audience: {},
          analytics: {},
        }),
      );
    await expect(
      new OmnisendApiAdapter().getCampaignSummary("access-token", boundaries),
    ).resolves.toEqual({
      campaign: {
        id: boundaries.campaignId,
        type: "regular",
        channel: "email",
        status: "sent",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        scheduledAt: null,
        sentAt: "2026-01-03T00:00:00Z",
        privateCampaignDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `https://api.omnisend.com/api/campaigns/${boundaries.campaignId}`,
    );
  });
  it("rejects non-ID selectors before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new OmnisendApiAdapter().getContactSummary("access-token", {
        ...boundaries,
        contactId: "private@example.com",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps retired API versions to a policy block", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ detail: "private" }, 410));
    await expect(
      new OmnisendApiAdapter().getCampaignSummary("access-token", boundaries),
    ).rejects.toMatchObject({ code: "policy_blocked", statusCode: 410 });
  });
});
