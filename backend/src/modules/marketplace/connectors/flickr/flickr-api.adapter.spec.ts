import { FlickrApiAdapter, FlickrApiError } from "./flickr-api.adapter";

const credentials = {
  consumerKey: "consumer-key",
  consumerSecret: "consumer-secret",
  accessToken: "access-token",
  accessTokenSecret: "access-secret",
};

describe("FlickrApiAdapter", () => {
  it("builds delete-permission authorization URLs", () => {
    const url = new URL(
      new FlickrApiAdapter().authorizationUrl("request-token"),
    );
    expect(url.origin).toBe("https://www.flickr.com");
    expect(url.searchParams.get("oauth_token")).toBe("request-token");
    expect(url.searchParams.get("perms")).toBe("delete");
  });

  it("rejects mutations through the read wrapper before fetch", async () => {
    await expect(
      new FlickrApiAdapter().read(credentials, "flickr.photos.delete", {
        photo_id: "123",
      }),
    ).rejects.toThrow(FlickrApiError);
  });

  it("requires an explicit photo id for replacements", async () => {
    await expect(
      new FlickrApiAdapter().upload(
        credentials,
        {
          base64: "eA==",
          mimeType: "image/jpeg",
          fileName: "photo.jpg",
        },
        true,
      ),
    ).rejects.toThrow("photoId is invalid");
  });
});
