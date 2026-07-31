import {
  DeviantArtApiAdapter,
  DeviantArtApiError,
} from "./deviantart-api.adapter";
describe("DeviantArtApiAdapter", () => {
  it("rejects mutations through the read boundary", () =>
    expect(() =>
      new DeviantArtApiAdapter().read("token", "/notes/delete", {}),
    ).toThrow(DeviantArtApiError));
  it("rejects arbitrary routes", () =>
    expect(() =>
      new DeviantArtApiAdapter().manage("token", "/admin/delete", {}),
    ).toThrow("official allowlist"));
  it("enforces provider pagination bounds before fetch", async () =>
    await expect(
      new DeviantArtApiAdapter().read("token", "/browse/home", { limit: 51 }),
    ).rejects.toThrow("1 through 50"));
});
