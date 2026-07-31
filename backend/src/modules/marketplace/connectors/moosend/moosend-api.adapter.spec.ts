import {
  MoosendApiAdapter,
  type MoosendCredentials,
} from "./moosend-api.adapter";
const credentials: MoosendCredentials = {
  apiKey: "test-api-key",
  mailingListId: "list-123",
  subscriberId: "sub-456",
  campaignId: "camp-789",
};
function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
describe("MoosendApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses one fixed list subscriber path and strips personal fields", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({
          Code: 0,
          Error: null,
          Context: {
            ID: "sub-456",
            CreatedOn: "/Date(1)/",
            UpdatedOn: "/Date(2)/",
            Name: "Private",
            Email: "private@example.com",
            CustomFields: [],
            Tags: [],
            Preferences: [],
          },
        }),
      );
    await expect(
      new MoosendApiAdapter().getSubscriberSummary(credentials),
    ).resolves.toEqual({
      subscriber: {
        id: "sub-456",
        createdOn: "/Date(1)/",
        updatedOn: "/Date(2)/",
        personalFieldsIncluded: false,
      },
    });
    const url = new URL(fetchMock.mock.calls[0][0].toString());
    expect(url.origin + url.pathname).toBe(
      "https://api.moosend.com/v3/subscribers/list-123/find/sub-456.json",
    );
    expect(url.searchParams.get("apikey")).toBe("test-api-key");
  });
  it("uses campaign details rather than statistics and redacts content", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({
          Code: 0,
          Error: null,
          Context: {
            ID: "camp-789",
            Status: "Sent",
            CreatedOn: "/Date(1)/",
            DeliveredOn: "/Date(2)/",
            IsTransactional: false,
            Name: "Private",
            Subject: "Private",
            HTMLContent: "Private",
            Sender: {},
            MailingLists: [],
          },
        }),
      );
    await expect(
      new MoosendApiAdapter().getCampaignSummary(credentials),
    ).resolves.toEqual({
      campaign: {
        id: "camp-789",
        status: "Sent",
        createdOn: "/Date(1)/",
        deliveredOn: "/Date(2)/",
        isTransactional: false,
        privateMessageDetailsIncluded: false,
      },
    });
    expect(new URL(fetchMock.mock.calls[0][0].toString()).pathname).toBe(
      "/v3/campaigns/camp-789/view.json",
    );
  });
  it("rejects unsafe selectors before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new MoosendApiAdapter().getSubscriberSummary({
        ...credentials,
        subscriberId: "../private",
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
      .mockImplementation(() => json({ Error: "private" }, 429));
    await expect(
      new MoosendApiAdapter().getCampaignSummary(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
