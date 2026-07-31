import {
  UnleashCloudApiAdapter,
  type UnleashCloudCredentials,
} from "./unleash-cloud-api.adapter";
import { UNLEASH_CLOUD_OPERATIONS } from "./unleash-cloud-operation-registry";

describe("UnleashCloudApiAdapter", () => {
  const credentials: UnleashCloudCredentials = {
    backendToken: "test-backend-token",
    instanceUrl: "https://us.app.unleash-hosted.com/staging-instance",
    projectId: "checkout",
    environment: "staging",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only Client API list and exact feature GETs", () => {
    expect(UNLEASH_CLOUD_OPERATIONS).toHaveLength(2);
    expect(UNLEASH_CLOUD_OPERATIONS.map((item) => item.path)).toEqual([
      "/api/client/features",
      "/api/client/features/{resourceId}",
    ]);
  });
  it("uses an allowlisted Cloud instance, token scope, bounds, and redaction", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          features: [
            {
              name: "new-checkout",
              project: "checkout",
              enabled: true,
              strategies: [{ constraints: [{ values: ["private-user"] }] }],
              variants: [{ payload: { value: "secret" } }],
              dependencies: [{ feature: "private-parent" }],
            },
            { name: "other", project: "another-project" },
          ],
          segments: [{ constraints: [{ value: "private" }] }],
        }),
      ),
    );
    const result = await new UnleashCloudApiAdapter().read(
      credentials,
      "list_features",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://us.app.unleash-hosted.com/staging-instance/api/client/features",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "test-backend-token",
    });
    expect(result.data).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("private-user");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain('"enabled"');
  });
  it("pins exact safe feature reads and enforces project binding", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"name":"new-checkout","project":"checkout"}'),
      );
    await new UnleashCloudApiAdapter().read(credentials, "get_feature", {
      resourceId: "new-checkout",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://us.app.unleash-hosted.com/staging-instance/api/client/features/new-checkout",
    );
  });
  it("blocks alternate origins, evaluation inputs, invalid IDs, and arbitrary operations", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new UnleashCloudApiAdapter();
    await expect(
      adapter.read(credentials, "list_features", { userId: "1" } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(
        { ...credentials, instanceUrl: "https://example.com/instance" },
        "list_features",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.read(credentials, "get_feature", { resourceId: "../members" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, "toggle_feature", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
