import { AirtableApiAdapter, AirtableApiError } from "./airtable-api.adapter";
import { AIRTABLE_CONNECTOR_MANIFEST } from "./airtable.connector";

describe("Airtable Marketplace connector", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("publishes nine bounded PKCE tools under Safe and Dangerous policies", () => {
    expect(AIRTABLE_CONNECTOR_MANIFEST.tools).toHaveLength(9);
    expect(AIRTABLE_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://airtable.com/oauth2/v1/authorize",
      tokenUrl: "https://airtable.com/oauth2/v1/token",
      refreshUrl: "https://airtable.com/oauth2/v1/token",
      pkce: true,
      supportsRefresh: true,
    });
    expect(
      AIRTABLE_CONNECTOR_MANIFEST.approvalProfiles[0].allowedActions,
    ).toHaveLength(6);
    expect(
      AIRTABLE_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions,
    ).toHaveLength(3);
    expect(
      AIRTABLE_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions,
    ).toHaveLength(9);
  });

  it("keeps record reads on one bounded page without exposing the token", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            records: [
              {
                id: "rec1",
                createdTime: "2026-07-16T00:00:00Z",
                fields: { fld1: "Relay" },
              },
            ],
            offset: "next",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch;
    const result = await new AirtableApiAdapter().listRecords("secret-token", {
      baseId: "app1",
      tableId: "tbl1",
      maxResults: 5,
    });
    expect(result).toMatchObject({
      count: 1,
      offsetReturned: true,
      nextPageFollowed: false,
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain("https://api.airtable.com/v0/app1/tbl1");
    expect(init.headers.Authorization).toBe("Bearer secret-token");
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("uses single-record PATCH and bounded fields for writes", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "rec1", fields: { fld1: "Done" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ) as typeof fetch;
    const result = await new AirtableApiAdapter().updateRecord("secret-token", {
      baseId: "app1",
      tableId: "tbl1",
      recordId: "rec1",
      fields: { fld1: "Done" },
      idempotencyKey: "airtable-update-1",
    });
    expect(result).toMatchObject({
      recordId: "rec1",
      idempotencyKey: "airtable-update-1",
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe("https://api.airtable.com/v0/app1/tbl1/rec1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toMatchObject({
      fields: { fld1: "Done" },
      returnFieldsByFieldId: true,
    });
  });

  it("rejects empty writes and maps rate limits safely", async () => {
    await expect(
      new AirtableApiAdapter().createRecord("token", {
        baseId: "app1",
        tableId: "tbl1",
        fields: {},
        idempotencyKey: "key",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { type: "TOO_MANY_REQUESTS" } }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ) as typeof fetch;
    await expect(
      new AirtableApiAdapter().listBases("token", {}),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AirtableApiError>>({
        code: "provider_rate_limited",
        statusCode: 429,
      }),
    );
  });
});
