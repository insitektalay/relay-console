import { DiscoEdiscoveryApiAdapter } from "./disco-ediscovery-api.adapter";
import { DISCO_EDISCOVERY_CONNECTOR_MANIFEST } from "./disco-ediscovery.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("DISCO eDiscovery connector", () => {
  const credentials = {
    apiKey: "disco-api-key-value",
    organizationId: "org_12345",
  };

  it("exposes bounded approved analytics reads", () => {
    expect(DISCO_EDISCOVERY_CONNECTOR_MANIFEST.slug).toBe("disco-ediscovery");
    expect(
      DISCO_EDISCOVERY_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "discoEdiscovery.listDatasets",
      "discoEdiscovery.getUsageSummary",
    ]);
    expect(
      DISCO_EDISCOVERY_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("lists only dataset identifiers for the bound organization", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(json({ datasets: ["data-usage-changes"] }));
    const result = await new DiscoEdiscoveryApiAdapter(requester).listDatasets(
      credentials,
    );
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.csdisco.com/datasets",
    );
    expect(requester.mock.calls[0][1]).toMatchObject({
      method: "POST",
      redirect: "error",
    });
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      "organization-id": "org_12345",
      "disco-api-key": "disco-api-key-value",
    });
    expect(result).toEqual({
      datasetCount: 1,
      datasets: ["data-usage-changes"],
      redactionStatus:
        "organization-id-review-database-matter-session-document-user-and-row-data-excluded",
    });
  });

  it("returns counts while redacting legal row content", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(
        json({
          "data-usage-changes": [
            {
              matter_name: "Acme Litigation",
              review_db_id: "reviewdb-1",
              session_key: "session-1",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          "metric-reviewdb-size": [
            {
              review_db_name: "Confidential Review",
              final_size: 1234,
            },
          ],
        }),
      );
    const result = await new DiscoEdiscoveryApiAdapter(
      requester,
    ).getUsageSummary(credentials, {
      startDate: "2026-07-01T00:00:00Z",
      endDate: "2026-07-02T00:00:00Z",
    });
    expect(result).toEqual({
      dataUsageChangeCount: 1,
      reviewDatabaseSizeCount: 1,
      startDate: "2026-07-01T00:00:00Z",
      endDate: "2026-07-02T00:00:00Z",
      redactionStatus:
        "matter-names-review-database-identifiers-session-identifiers-legal-row-data-and-raw-provider-payloads-excluded",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Acme|reviewdb-1|session-1|Confidential|1234/,
    );
  });

  it("rejects invalid organization bindings", async () => {
    await expect(
      new DiscoEdiscoveryApiAdapter(jest.fn()).health({
        ...credentials,
        organizationId: "../other",
      }),
    ).rejects.toMatchObject({ code: "credential_missing", statusCode: 401 });
  });

  it("preserves provider rate limits", async () => {
    await expect(
      new DiscoEdiscoveryApiAdapter(
        jest.fn().mockResolvedValue(json({}, 429)),
      ).health(credentials),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
