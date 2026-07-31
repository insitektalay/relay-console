import { CensusApiAdapter } from "./census-api.adapter";
import { CENSUS_CONNECTOR_MANIFEST } from "./census.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Census connector", () => {
  const credentials = { apiKey: "test-workspace-key" };

  it("exposes one approved dataset-readiness aggregate", () => {
    expect(CENSUS_CONNECTOR_MANIFEST.slug).toBe("census");
    expect(CENSUS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "census.getDatasetReadinessSummary",
    ]);
    expect(CENSUS_CONNECTOR_MANIFEST.tools[0].approvalRequired).toBe(true);
  });

  it("uses the fixed bounded endpoint and returns only total records", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        status: "success",
        pagination: { total_records: 14, page: 1, next_page: 2 },
        data: [
          {
            id: 157,
            name: "VIP Customers",
            query: "select email from customers",
            source_id: 123,
          },
        ],
      }),
    );
    const result = await new CensusApiAdapter(
      requester,
    ).getDatasetReadinessSummary(credentials);
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://app.getcensus.com/api/v1/datasets?page=1&per_page=1&order=desc",
    );
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      Authorization: "Bearer test-workspace-key",
    });
    expect(result).toEqual({
      datasetCount: 14,
      redactionStatus:
        "dataset-identity-query-source-sync-destination-run-and-customer-data-excluded",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /157|VIP Customers|select email|customers|123|test-workspace-key/,
    );
  });

  it("rejects malformed keys before network access", async () => {
    const requester = jest.fn();
    await expect(
      new CensusApiAdapter(requester).health({ apiKey: "bad\nkey" }),
    ).rejects.toMatchObject({ code: "credential_missing", statusCode: 401 });
    expect(requester).not.toHaveBeenCalled();
  });

  it("preserves provider rate limits", async () => {
    await expect(
      new CensusApiAdapter(
        jest.fn().mockResolvedValue(json({}, 429)),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
