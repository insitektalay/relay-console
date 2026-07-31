import { MarketoApiAdapter, MarketoApiError } from "./marketo-api.adapter";

const credentials = {
  subscriptionId: "284-RPR-133",
  clientId: "client-id",
  clientSecret: "client-secret",
  apiUser: "relay-api@example.com",
  leadId: "318581",
  programId: "1107",
};

describe("MarketoApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("binds the API-only user and strips selected lead PII", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "token",
            token_type: "bearer",
            expires_in: 3599,
            scope: "relay-api@example.com",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            result: [
              {
                id: 318581,
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-02T00:00:00Z",
                email: "private@example.com",
                firstName: "Private",
                customField: "private",
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const result = await new MarketoApiAdapter().getLeadSummary(credentials);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://284-rpr-133.mktorest.com/identity/oauth/token?grant_type=client_credentials&client_id=client-id&client_secret=client-secret",
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://284-rpr-133.mktorest.com/rest/v1/lead/318581.json?fields=id%2CcreatedAt%2CupdatedAt",
    );
    expect(
      (fetchMock.mock.calls[1][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer token");
    expect(result.lead).toEqual({
      id: "318581",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      personalFieldsIncluded: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/email|firstName|customField/i);
  });

  it("reuses the token and projects only bounded program metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "token",
            token_type: "bearer",
            expires_in: 3599,
            scope: "relay-api@example.com",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, result: [{ id: 318581 }] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            result: [
              {
                id: 1107,
                name: "Launch",
                type: "Default",
                status: "on",
                channel: "Online Advertising",
                workspace: "Default",
                description: "private",
                tags: [{ tagType: "private" }],
                costs: [{ cost: 100 }],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const adapter = new MarketoApiAdapter();
    await adapter.getLeadSummary(credentials);
    const result = await adapter.getProgramSummary(credentials);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toBe(
      "https://284-rpr-133.mktorest.com/rest/asset/v1/program/1107.json",
    );
    expect(result.program).toEqual({
      id: "1107",
      name: "Launch",
      type: "Default",
      status: "on",
      channel: "Online Advertising",
      workspace: "Default",
      privateAssetDetailsIncluded: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/description|tags|cost/i);
  });

  it("rejects a token owned by a different API-only user", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "token",
          token_type: "bearer",
          expires_in: 3599,
          scope: "broader-admin@example.com",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new MarketoApiAdapter().getProgramSummary(credentials),
    ).rejects.toMatchObject<Partial<MarketoApiError>>({
      code: "insufficient_scope",
    });
  });

  it("maps Marketo response-level permission errors safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "token",
            token_type: "bearer",
            expires_in: 3599,
            scope: "relay-api@example.com",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            errors: [{ code: "603", message: "Access denied" }],
          }),
          { status: 200 },
        ),
      );
    await expect(
      new MarketoApiAdapter().getProgramSummary(credentials),
    ).rejects.toMatchObject<Partial<MarketoApiError>>({
      code: "insufficient_scope",
      statusCode: 403,
    });
  });
});
