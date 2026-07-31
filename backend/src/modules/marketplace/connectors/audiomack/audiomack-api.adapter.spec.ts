import {
  AudiomackApiAdapter,
  AudiomackApiError,
} from "./audiomack-api.adapter";

const credentials = {
  consumerKey: "key",
  consumerSecret: "secret",
  accessToken: "token",
  accessTokenSecret: "token-secret",
};

describe("AudiomackApiAdapter", () => {
  it("rejects operations outside the pinned registry", async () => {
    await expect(
      new AudiomackApiAdapter().execute(credentials, "music-play", {}),
    ).rejects.toThrow(AudiomackApiError);
  });
  it("rejects unbounded pagination", async () => {
    await expect(
      new AudiomackApiAdapter().execute(credentials, "music-recent", {
        query: { limit: 0 },
      }),
    ).rejects.toThrow("1 through 100");
  });
  it("rejects credential-bearing input before fetch", async () => {
    await expect(
      new AudiomackApiAdapter().execute(credentials, "search", {
        query: { access_token: "nope" },
      }),
    ).rejects.toThrow("Credential-bearing");
  });
});
