import { BandcampApiAdapter, BandcampApiError } from "./bandcamp-api.adapter";
const credentials = {
  clientId: "client",
  clientSecret: "secret",
  refreshToken: "refresh",
};
describe("BandcampApiAdapter", () => {
  it("rejects inventory mutations through read", () =>
    expect(() =>
      new BandcampApiAdapter().read(credentials, "update-quantities", {}),
    ).toThrow(BandcampApiError));
  it("rejects unregistered operations", () =>
    expect(() =>
      new BandcampApiAdapter().manage(credentials, "publish-album", {}),
    ).toThrow("pinned registry"));
  it("rejects credential-bearing inputs", async () =>
    await expect(
      new BandcampApiAdapter().read(credentials, "my-bands", {
        accessToken: "no",
      }),
    ).rejects.toThrow("Credential-bearing"));
});
