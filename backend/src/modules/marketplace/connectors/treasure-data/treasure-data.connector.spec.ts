import { TreasureDataApiAdapter } from "./treasure-data-api.adapter";
import { TREASURE_DATA_CONNECTOR_MANIFEST } from "./treasure-data.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Treasure Data connector", () => {
  const credentials = { apiKey: "test-api-key", apiRegion: "eu01" };

  it("exposes one approved database-readiness aggregate", () => {
    expect(TREASURE_DATA_CONNECTOR_MANIFEST.slug).toBe("treasure-data");
    expect(TREASURE_DATA_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "treasureData.getDatabaseReadinessSummary",
    ]);
    expect(TREASURE_DATA_CONNECTOR_MANIFEST.tools[0].approvalRequired).toBe(true);
  });

  it("uses the fixed regional database-list endpoint and returns only counts", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        databases: [
          {
            id: "private-id",
            name: "customers",
            count: 999,
            organization: "Private Org",
            permission: "full_access",
            delete_protected: true,
          },
          {
            id: "other-id",
            name: "events",
            count: 42,
            permission: "query_only",
            delete_protected: false,
          },
        ],
      }),
    );
    const result = await new TreasureDataApiAdapter(
      requester,
    ).getDatabaseReadinessSummary(credentials);
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.eu01.treasuredata.com/v3/database/list?require_permissions=true",
    );
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      Authorization: "TD1 test-api-key",
    });
    expect(result).toEqual({
      databaseCount: 2,
      deleteProtectedCount: 1,
      redactionStatus:
        "database-identity-record-count-permission-table-schema-query-job-and-customer-data-excluded",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private-id|customers|999|Private Org|full_access|other-id|events|42|query_only|test-api-key/,
    );
  });

  it("rejects arbitrary regional origins before network access", async () => {
    const requester = jest.fn();
    await expect(
      new TreasureDataApiAdapter(requester).health({
        ...credentials,
        apiRegion: "https://example.com",
      }),
    ).rejects.toMatchObject({ code: "credential_missing", statusCode: 401 });
    expect(requester).not.toHaveBeenCalled();
  });

  it("preserves provider rate limits", async () => {
    await expect(
      new TreasureDataApiAdapter(
        jest.fn().mockResolvedValue(json({}, 429)),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
