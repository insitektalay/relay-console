import { PardotApiAdapter, PardotApiError } from "./pardot-api.adapter";

const credentials = {
  environment: "sandbox",
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
  businessUnitId: "0Uv123456789012ABC",
  prospectId: "101",
  campaignId: "202",
};

describe("PardotApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("refreshes at the sandbox origin and strips prospect private data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 101,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
            email: "private@example.com",
            score: 99,
            custom__c: "private",
          }),
          { status: 200 },
        ),
      );
    const result = await new PardotApiAdapter().getProspectSummary(credentials);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://test.salesforce.com/services/oauth2/token",
    );
    expect(fetchMock.mock.calls[0][1]?.body).toContain(
      "grant_type=refresh_token",
    );
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://pi.demo.pardot.com/api/v5/objects/prospects/101?fields=id%2CcreatedAt%2CupdatedAt",
    );
    expect(
      (fetchMock.mock.calls[1][1]?.headers as Record<string, string>)[
        "Pardot-Business-Unit-Id"
      ],
    ).toBe(credentials.businessUnitId);
    expect(result.prospect).toEqual({
      id: "101",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      personalFieldsIncluded: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/email|score|custom/i);
  });
  it("reuses the token and projects bounded campaign metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 101 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 202,
            name: "Launch",
            isDeleted: false,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
            cost: 100,
            folder: { id: 1 },
            createdBy: { email: "private" },
          }),
          { status: 200 },
        ),
      );
    const adapter = new PardotApiAdapter();
    await adapter.getProspectSummary(credentials);
    const result = await adapter.getCampaignSummary(credentials);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.campaign).toEqual({
      id: "202",
      name: "Launch",
      isDeleted: false,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      privateCampaignDetailsIncluded: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/cost|folder|createdBy/i);
  });
  it("rejects a malformed business unit before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new PardotApiAdapter().getCampaignSummary({
        ...credentials,
        businessUnitId: "wrong",
      }),
    ).rejects.toMatchObject<Partial<PardotApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
