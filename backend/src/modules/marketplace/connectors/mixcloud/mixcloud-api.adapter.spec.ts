import { MixcloudApiAdapter, MixcloudApiError } from "./mixcloud-api.adapter";

describe("MixcloudApiAdapter", () => {
  it("rejects mutation suffixes through the read boundary", () => {
    expect(() =>
      new MixcloudApiAdapter().read("token", "/user/show/favorite/", {}),
    ).toThrow(MixcloudApiError);
  });

  it("requires user keys for follow and show keys for show engagement", () => {
    expect(() =>
      new MixcloudApiAdapter().engage("token", "/user/show/", "follow", false),
    ).toThrow("does not match");
    expect(() =>
      new MixcloudApiAdapter().engage("token", "/user/", "favorite", false),
    ).toThrow("does not match");
  });

  it("rejects oversized decoded MP3 uploads before fetch", async () => {
    const payload = Buffer.alloc(25_000_001).toString("base64");
    await expect(
      new MixcloudApiAdapter().upload(
        "token",
        { base64: payload, fileName: "show.mp3" },
        false,
      ),
    ).rejects.toThrow("25 MB");
  });
});
