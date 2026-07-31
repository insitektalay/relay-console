import { RescueTimeApiAdapter, RescueTimeApiError } from "./rescuetime-api.adapter";

describe("RescueTimeApiAdapter", () => {
  const adapter = new RescueTimeApiAdapter();

  it("rejects operations outside the pinned contract", () => {
    expect(() => adapter.read("token", "get_anything", {})).toThrow(
      expect.objectContaining({
      code: "provider_validation_error",
      } satisfies Partial<RescueTimeApiError>),
    );
  });

  it("keeps read and mutation tools separated", () => {
    expect(() => adapter.read("token", "post_resource_alerts", {})).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
    expect(() => adapter.manage("token", "get_resource_users", {})).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
  });

  it("rejects credential-bearing request fields before network access", async () => {
    await expect(adapter.manage("token", "post_resource_alerts", { json: { api_key: "secret" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("requires exact documented path parameters", async () => {
    await expect(adapter.read("token", "get_resource_users_id", { pathParameters: { wrong: 1 } })).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
