import {
  FlagsmithCloudApiAdapter,
  type FlagsmithCloudCredentials,
} from "./flagsmith-cloud-api.adapter";
import { FLAGSMITH_CLOUD_OPERATIONS } from "./flagsmith-cloud-operation-registry";

describe("FlagsmithCloudApiAdapter", () => {
  const credentials: FlagsmithCloudCredentials = {
    serviceAccountToken: "test-token",
    projectId: "123",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only project-level list and exact feature GETs", () => {
    expect(FLAGSMITH_CLOUD_OPERATIONS).toHaveLength(2);
    expect(
      FLAGSMITH_CLOUD_OPERATIONS.every((item) =>
        item.path.includes("/projects/{projectId}/features/"),
      ),
    ).toBe(true);
  });
  it("uses fixed Cloud/project routing, bounds, and Token authentication", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 7,
                name: "checkout",
                initial_value: "secret",
                owners: [99],
                metadata: [{ value: "private" }],
                multivariate_options: [{ string_value: "payload" }],
              },
            ],
            count: 1,
            next: "private-cursor",
          }),
        ),
      );
    const result = await new FlagsmithCloudApiAdapter().read(
      credentials,
      "list_features",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.flagsmith.com/api/v1/projects/123/features/?page=1&page_size=25&is_archived=false",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Token test-token",
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("private-cursor");
  });
  it("pins exact positive-integer feature reads", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"id":7,"name":"checkout"}'));
    await new FlagsmithCloudApiAdapter().read(credentials, "get_feature", {
      resourceId: 7,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.flagsmith.com/api/v1/projects/123/features/7/",
    );
  });
  it("blocks environment, pagination, invalid IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new FlagsmithCloudApiAdapter();
    await expect(
      adapter.read(credentials, "list_features", { environment: 4 } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(credentials, "get_feature", { resourceId: "../identities" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, "update_feature", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
