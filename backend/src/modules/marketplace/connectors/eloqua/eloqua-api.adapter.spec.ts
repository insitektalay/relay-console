import { EloquaApiAdapter, type EloquaCredentials } from "./eloqua-api.adapter";

const credentials: EloquaCredentials = {
  siteName: "Relay Staging",
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
  contactId: "41",
  campaignId: "73",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("EloquaApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("discovers and binds the site pod while stripping contact PII", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementationOnce(() =>
        json({ access_token: "access-token", expires_in: 3600 }),
      )
      .mockImplementationOnce(() =>
        json({
          site: { id: 12, name: "Relay Staging" },
          user: { emailAddress: "private@example.com" },
          urls: { base: "https://secure.p03.eloqua.com" },
        }),
      )
      .mockImplementationOnce(() =>
        json({
          id: "41",
          createdAt: "1700000000",
          updatedAt: "1700000001",
          name: "private@example.com",
          emailAddress: "private@example.com",
          fieldValues: [{ value: "private" }],
        }),
      );
    const result = await new EloquaApiAdapter().getContactSummary(credentials);
    expect(result).toEqual({
      contact: {
        id: "41",
        createdAt: "1700000000",
        updatedAt: "1700000001",
        personalFieldsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://login.eloqua.com/auth/oauth2/token",
    );
    expect(fetchMock.mock.calls[1][0].toString()).toBe(
      "https://login.eloqua.com/id",
    );
    expect(fetchMock.mock.calls[2][0].toString()).toBe(
      "https://secure.p03.eloqua.com/API/REST/2.0/data/contact/41?depth=minimal",
    );
    expect(
      (fetchMock.mock.calls[2][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer access-token");
  });

  it("reuses the bound token and projects only bounded campaign metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementationOnce(() =>
        json({ access_token: "access-token", expires_in: 3600 }),
      )
      .mockImplementationOnce(() =>
        json({
          site: { id: 12, name: "Relay Staging" },
          urls: { base: "https://secure.p04.eloqua.com" },
        }),
      )
      .mockImplementation(() =>
        json({
          id: "73",
          name: "Staging nurture",
          currentStatus: "Draft",
          createdAt: "1700000000",
          updatedAt: "1700000002",
          description: "private",
          actualCost: "999",
          fieldValues: [{ value: "private" }],
        }),
      );
    const adapter = new EloquaApiAdapter();
    const first = await adapter.getCampaignSummary(credentials);
    const second = await adapter.getCampaignSummary(credentials);
    expect(first).toEqual({
      campaign: {
        id: "73",
        name: "Staging nurture",
        currentStatus: "Draft",
        createdAt: "1700000000",
        updatedAt: "1700000002",
        privateCampaignDetailsIncluded: false,
      },
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("rejects a grant for a different site", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementationOnce(() => json({ access_token: "access-token" }))
      .mockImplementationOnce(() =>
        json({
          site: { name: "Another Site" },
          urls: { base: "https://secure.p03.eloqua.com" },
        }),
      );
    await expect(
      new EloquaApiAdapter().getCampaignSummary(credentials),
    ).rejects.toMatchObject({ code: "insufficient_scope", statusCode: 403 });
  });

  it("rejects malformed selected IDs before making a network call", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new EloquaApiAdapter().getContactSummary({
        ...credentials,
        contactId: "41/activities",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
