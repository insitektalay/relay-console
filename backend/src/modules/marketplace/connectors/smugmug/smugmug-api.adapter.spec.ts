import { SmugMugApiAdapter, SmugMugApiError } from "./smugmug-api.adapter";

const credentials = {
  consumerKey: "consumer-key",
  consumerSecret: "consumer-secret",
  accessToken: "access-token",
  accessTokenSecret: "access-secret",
};

describe("SmugMugApiAdapter", () => {
  it("builds Full/Modify authorization URLs", () => {
    const url = new URL(
      new SmugMugApiAdapter().authorizationUrl("request-token"),
    );
    expect(url.origin).toBe("https://api.smugmug.com");
    expect(url.searchParams.get("oauth_token")).toBe("request-token");
    expect(url.searchParams.get("Access")).toBe("Full");
    expect(url.searchParams.get("Permissions")).toBe("Modify");
  });

  it("rejects noncanonical API paths and credential-bearing payloads before fetch", async () => {
    const adapter = new SmugMugApiAdapter();
    await expect(
      adapter.read(credentials, { uri: "https://evil.example/api/v2" }),
    ).rejects.toThrow(SmugMugApiError);
    await expect(
      adapter.manage(credentials, "POST", {
        uri: "/api/v2/album/abc",
        json: { accessToken: "must-not-pass" },
      }),
    ).rejects.toThrow("Credential-bearing field");
  });

  it("requires a canonical explicit album for bounded uploads", async () => {
    await expect(
      new SmugMugApiAdapter().upload(credentials, {
        albumUri: "/api/v2/user/abc",
        base64: "eA==",
        mimeType: "image/jpeg",
        fileName: "photo.jpg",
      }),
    ).rejects.toThrow("albumUri must identify one album");
  });
});
