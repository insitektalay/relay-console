import {
  VwoTestingApiAdapter,
  type VwoTestingCredentials,
} from "./vwo-testing-api.adapter";
import { VWO_TESTING_OPERATIONS } from "./vwo-testing-operation-registry";

describe("VwoTestingApiAdapter", () => {
  const credentials: VwoTestingCredentials = {
    personalApiToken: "test-api-token",
    accountId: "123456",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only current workspace feature flag list and exact GETs", () => {
    expect(VWO_TESTING_OPERATIONS).toHaveLength(2);
    expect(VWO_TESTING_OPERATIONS.map((item) => item.path)).toEqual([
      "/api/v2/accounts/{accountId}/features",
      "/api/v2/accounts/{accountId}/features/{resourceId}",
    ]);
  });
  it("uses fixed workspace routing, bounds, token auth, and redaction", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 7,
              key: "new-checkout",
              name: "New checkout",
              environments: [{ enabled: true, rules: [{ value: "private" }] }],
              variables: [{ key: "color", defaultValue: "secret" }],
              sdkKey: "private-sdk-key",
            },
          ],
          total: 1,
          next: "private-cursor",
        }),
      ),
    );
    const result = await new VwoTestingApiAdapter().read(
      credentials,
      "list_feature_flags",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.vwo.com/api/v2/accounts/123456/features?limit=25&offset=0",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      token: "test-api-token",
    });
    expect(JSON.stringify(result)).not.toContain("private-sdk-key");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("private-cursor");
  });
  it("pins exact safe feature reads", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"data":{"id":7,"key":"checkout"}}'),
      );
    await new VwoTestingApiAdapter().read(credentials, "get_feature_flag", {
      resourceId: 7,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.vwo.com/api/v2/accounts/123456/features/7",
    );
  });
  it("blocks evaluation, pagination, invalid IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new VwoTestingApiAdapter();
    await expect(
      adapter.read(credentials, "list_feature_flags", {
        environment: "prod",
      } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(credentials, "get_feature_flag", { resourceId: "../users" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, "toggle_feature", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
