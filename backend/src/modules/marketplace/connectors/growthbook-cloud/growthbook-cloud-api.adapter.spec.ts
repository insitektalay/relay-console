import {
  GrowthBookCloudApiAdapter,
  type GrowthBookCloudCredentials,
} from "./growthbook-cloud-api.adapter";
import { GROWTHBOOK_CLOUD_OPERATIONS } from "./growthbook-cloud-operation-registry";

describe("GrowthBookCloudApiAdapter", () => {
  const credentials: GrowthBookCloudCredentials = {
    secretApiKey: "test-secret-key",
    projectId: "prj_staging",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only feature list and exact metadata GETs", () => {
    expect(GROWTHBOOK_CLOUD_OPERATIONS).toHaveLength(2);
    expect(GROWTHBOOK_CLOUD_OPERATIONS.map((item) => item.path)).toEqual([
      "/api/v1/features",
      "/api/v1/features/{resourceId}",
    ]);
  });
  it("uses fixed Cloud/project routing, first-page bounds, Bearer auth, and redaction", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          features: [
            {
              id: "checkout",
              owner: "private@example.test",
              defaultValue: "secret-value",
              environments: { production: { rules: [{ value: "secret" }] } },
              revision: { createdBy: "private-user" },
              tags: ["release"],
            },
          ],
          count: 1,
          total: 1,
          hasMore: false,
          nextOffset: 25,
        }),
      ),
    );
    const result = await new GrowthBookCloudApiAdapter().read(
      credentials,
      "list_features",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.growthbook.io/api/v1/features?limit=25&offset=0&projectId=prj_staging",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer test-secret-key",
    });
    expect(JSON.stringify(result)).not.toContain("secret-value");
    expect(JSON.stringify(result)).not.toContain("private@example.test");
    expect(JSON.stringify(result)).not.toContain("nextOffset");
  });
  it("pins exact feature reads and disables revisions", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"feature":{"id":"checkout"}}'));
    await new GrowthBookCloudApiAdapter().read(credentials, "get_feature", {
      resourceId: "checkout",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.growthbook.io/api/v1/features/checkout?withRevisions=none",
    );
  });
  it("blocks environments, pagination, invalid IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new GrowthBookCloudApiAdapter();
    await expect(
      adapter.read(credentials, "list_features", { offset: 25 } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(credentials, "get_feature", { resourceId: "../members" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, "toggle_feature", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
