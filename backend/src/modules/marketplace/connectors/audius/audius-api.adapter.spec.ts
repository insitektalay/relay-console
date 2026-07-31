import { AudiusApiAdapter, AudiusApiError } from "./audius-api.adapter";

describe("AudiusApiAdapter", () => {
  it("blocks financial and authorization-administration routes", () => {
    expect(() => new AudiusApiAdapter().read("token", "/coins", {})).toThrow(
      AudiusApiError,
    );
    expect(() =>
      new AudiusApiAdapter().manage("token", "POST", "/users/1/grants", {}),
    ).toThrow("financial");
  });
  it("blocks stream transfer routes", () => {
    expect(() =>
      new AudiusApiAdapter().read("token", "/tracks/1/stream", {}),
    ).toThrow("media-transfer");
  });
  it("rejects unbounded page sizes before fetch", async () => {
    await expect(
      new AudiusApiAdapter().read("token", "/tracks/trending", { limit: 0 }),
    ).rejects.toThrow("1 through 100");
  });
});
