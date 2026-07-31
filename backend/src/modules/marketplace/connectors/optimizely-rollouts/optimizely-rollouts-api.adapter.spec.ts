import {
  OptimizelyRolloutsApiAdapter,
  type OptimizelyRolloutsCredentials,
} from "./optimizely-rollouts-api.adapter";
import { OPTIMIZELY_ROLLOUTS_OPERATIONS } from "./optimizely-rollouts-operation-registry";

describe("OptimizelyRolloutsApiAdapter", () => {
  const credentials: OptimizelyRolloutsCredentials = {
    personalAccessToken: "test-viewer-token",
    projectId: "12345",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only current Feature Experimentation flag list and exact GETs", () => {
    expect(OPTIMIZELY_ROLLOUTS_OPERATIONS).toHaveLength(2);
    expect(OPTIMIZELY_ROLLOUTS_OPERATIONS.map((item) => item.path)).toEqual([
      "/flags/v1/projects/{projectId}/flags",
      "/flags/v1/projects/{projectId}/flags/{resourceId}",
    ]);
  });
  it("uses fixed project routing, first-page bounds, Bearer auth, and redaction", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          page: 1,
          count: 1,
          total_count: 1,
          total_pages: 1,
          items: [
            {
              id: 7,
              key: "new-checkout",
              project_id: 12345,
              created_by_user_email: "private@example.test",
              account_id: 99,
              role: "admin",
              variable_definitions: {
                color: { default_value: "secret-value" },
              },
              environments: {
                production: { rules_detail: [{ audience_ids: [1] }] },
              },
            },
          ],
          next_url: "/private-cursor",
        }),
      ),
    );
    const result = await new OptimizelyRolloutsApiAdapter().read(
      credentials,
      "list_flags",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.optimizely.com/flags/v1/projects/12345/flags?per_page=25&page_number=1&archived=false",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer test-viewer-token",
    });
    expect(JSON.stringify(result)).not.toContain("secret-value");
    expect(JSON.stringify(result)).not.toContain("private@example.test");
    expect(JSON.stringify(result)).not.toContain("private-cursor");
  });
  it("pins exact safe flag reads and enforces project binding", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"id":7,"key":"new-checkout","project_id":12345}'),
      );
    await new OptimizelyRolloutsApiAdapter().read(credentials, "get_flag", {
      resourceId: "new-checkout",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.optimizely.com/flags/v1/projects/12345/flags/new-checkout",
    );
  });
  it("blocks environments, pagination, invalid IDs, and legacy or mutation operations", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new OptimizelyRolloutsApiAdapter();
    await expect(
      adapter.read(credentials, "list_flags", { page: 2 } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(credentials, "get_flag", { resourceId: "../users" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, "update_flag", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
