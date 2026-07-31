import { DribbbleApiAdapter, DribbbleApiError } from "./dribbble-api.adapter";

describe("DribbbleApiAdapter", () => {
  it("rejects mutation operations through the read boundary", () => {
    expect(() =>
      new DribbbleApiAdapter().read("token", "delete-shot", {
        path: { shotId: 1 },
      }),
    ).toThrow(DribbbleApiError);
  });

  it("rejects unregistered operations before fetch", () => {
    expect(() =>
      new DribbbleApiAdapter().read("token", "list-everything", {}),
    ).toThrow("pinned registry");
  });

  it("requires bounded supported image uploads", async () => {
    await expect(
      new DribbbleApiAdapter().manage("token", "create-shot", {
        base64: "eA==",
        fileName: "shot.svg",
        mimeType: "image/svg+xml",
      }),
    ).rejects.toThrow("GIF, JPEG, or PNG");
  });
});
