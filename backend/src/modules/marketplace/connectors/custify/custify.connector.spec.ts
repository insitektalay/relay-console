import { CustifyApiAdapter, CustifyApiError } from "./custify-api.adapter";
import { CUSTIFY_CONNECTOR_MANIFEST } from "./custify.connector";

const credentials = { apiKey: "api-key", apiOrigin: "https://api.custify.com" };
describe("Custify connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("publishes one approval-gated segment read", () => {
    expect(CUSTIFY_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual(
      ["read"],
    );
    expect(
      CUSTIFY_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["custify_segments_list"]);
  });
  it("checks credentials without returning segment data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ total: 1, segments: [{ name: "Private" }] }),
          { status: 200 },
        ),
      );
    const result = await new CustifyApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactOriginBound: true,
      segmentDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
  });
  it("lists only bounded projected segment metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            total: 1,
            segments: [
              {
                id: "segment-1",
                name: "Enterprise",
                goal: "Private goal",
                tags: ["private-tag"],
                type: "company",
                created_at: "2026-01-01",
                updated_at: "2026-02-01",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new CustifyApiAdapter().listSegments(credentials, {
      limit: 1,
      type: "company",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.custify.com/segment?itemsPerPage=1&page=1&type=company",
    );
    expect(result.segments).toEqual([
      {
        id: "segment-1",
        name: "Enterprise",
        type: "company",
        createdAt: "2026-01-01",
        updatedAt: "2026-02-01",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /Private goal|private-tag|"goal":|"tags":/,
    );
  });
  it("rejects missing keys, unsafe origins, types, and limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new CustifyApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiKey: "" }),
    ).rejects.toBeInstanceOf(CustifyApiError);
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://example.test" }),
    ).rejects.toBeInstanceOf(CustifyApiError);
    await expect(
      adapter.listSegments(credentials, { type: "all" }),
    ).rejects.toBeInstanceOf(CustifyApiError);
    await expect(
      adapter.listSegments(credentials, { limit: 51 }),
    ).rejects.toBeInstanceOf(CustifyApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new CustifyApiAdapter().listSegments(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
