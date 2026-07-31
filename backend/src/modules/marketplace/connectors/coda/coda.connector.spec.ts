import { CodaApiAdapter, CodaApiError } from "./coda-api.adapter";
import { CODA_CONNECTOR_MANIFEST } from "./coda.connector";

describe("Coda connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses one encrypted customer token and exposes bounded typed tools", () => {
    expect(CODA_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(CODA_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "CODA_API_TOKEN", secret: true }),
      ]),
    );
    expect(CODA_CONNECTOR_MANIFEST.tools).toHaveLength(10);
    expect(
      CODA_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
    expect(
      CODA_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("validates the token with whoami without exposing it", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "Alex",
          loginId: "a@example.com",
          scoped: true,
          tokenName: "Relay",
        }),
        { status: 200 },
      ),
    );
    const result = await new CodaApiAdapter().health({
      apiToken: "secret-token",
    });
    expect(result).toMatchObject({
      name: "Alex",
      scoped: true,
      providerRequestCount: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://coda.io/apis/v1/whoami",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token",
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("bounds list results and never follows provider pagination", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: Array.from({ length: 3 }, (_, index) => ({
            id: `doc-${index}`,
          })),
          nextPageToken: "next-secret",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new CodaApiAdapter().listDocs({ apiToken: "token" }, { maxResults: 2 }),
    ).resolves.toMatchObject({
      count: 2,
      nextPageAvailable: true,
      nextPageFollowed: false,
      providerRequestCount: 1,
    });
  });

  it("sends one structurally bounded update and maps provider failures safely", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ requestId: "request-1", id: "row-1" }), {
          status: 202,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: "contains provider internals" }),
          { status: 429 },
        ),
      );
    await new CodaApiAdapter().updateRow(
      { apiToken: "token" },
      {
        docId: "doc-1",
        tableId: "grid-1",
        rowId: "row-1",
        cells: [{ column: "col-1", value: "Done" }],
        idempotencyKey: "change-1",
      },
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://coda.io/apis/v1/docs/doc-1/tables/grid-1/rows/row-1",
    );
    expect(
      JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)),
    ).toEqual({ row: { cells: [{ column: "col-1", value: "Done" }] } });
    await expect(
      new CodaApiAdapter().listDocs({ apiToken: "token" }, {}),
    ).rejects.toMatchObject<Partial<CodaApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
      message: "Coda rate limit reached; retry later.",
    });
  });
});
