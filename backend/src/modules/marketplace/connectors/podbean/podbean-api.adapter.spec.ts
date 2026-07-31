import { PodbeanApiAdapter, PodbeanApiError } from "./podbean-api.adapter";
describe("PodbeanApiAdapter", () => {
  it("rejects unpinned operations", () => {
    expect(() =>
      new PodbeanApiAdapter().execute("token", "members-delete", {}),
    ).toThrow(PodbeanApiError);
  });
  it("blocks remote fetch fields", async () => {
    await expect(
      new PodbeanApiAdapter().execute("token", "episode-create", {
        parameters: { remote_media_url: "https://example.com/a.mp3" },
      }),
    ).rejects.toThrow("invalid");
  });
  it("rejects unbounded pages", async () => {
    await expect(
      new PodbeanApiAdapter().execute("token", "episodes-list", {
        parameters: { limit: 0 },
      }),
    ).rejects.toThrow("1 through 100");
  });
});
