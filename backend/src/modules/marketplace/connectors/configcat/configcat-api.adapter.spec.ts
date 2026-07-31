import {
  ConfigCatApiAdapter,
  type ConfigCatCredentials,
} from "./configcat-api.adapter";
import { CONFIGCAT_OPERATIONS } from "./configcat-operation-registry";

describe("ConfigCatApiAdapter", () => {
  const credentials: ConfigCatCredentials = {
    publicApiUsername: "public-user",
    publicApiPassword: "test-password",
    configId: "46ff6d11-d8b2-40d8-9197-dfa33c61cd6c",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only config flag list and exact metadata GETs", () => {
    expect(CONFIGCAT_OPERATIONS).toHaveLength(2);
    expect(CONFIGCAT_OPERATIONS.map((item) => item.path)).toEqual([
      "/v1/configs/{configId}/settings",
      "/v1/settings/{resourceId}",
    ]);
  });
  it("uses fixed API/config routing, bounds, Basic auth, and strips values", async () => {
    const flags = Array.from({ length: 26 }, (_, index) => ({
      settingId: index + 1,
      key: `flag-${index + 1}`,
      name: "Checkout",
      predefinedVariations: [{ value: { stringValue: "secret" } }],
      rolloutRules: [{ comparator: "private" }],
    }));
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(flags)));
    const result = await new ConfigCatApiAdapter().read(
      credentials,
      "list_flags",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.configcat.com/v1/configs/46ff6d11-d8b2-40d8-9197-dfa33c61cd6c/settings",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("public-user:test-password").toString("base64")}`,
    });
    expect(result.data).toHaveLength(25);
    expect(result.pagination).toEqual({ returned: 25, truncated: true });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("pins exact positive-integer flag reads", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"settingId":7,"key":"checkout"}'));
    await new ConfigCatApiAdapter().read(credentials, "get_flag", {
      resourceId: 7,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.configcat.com/v1/settings/7",
    );
  });
  it("blocks values, pagination, invalid IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new ConfigCatApiAdapter();
    await expect(
      adapter.read(credentials, "list_flags", { value: true } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(credentials, "get_flag", { resourceId: "../products" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, "update_flag", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
