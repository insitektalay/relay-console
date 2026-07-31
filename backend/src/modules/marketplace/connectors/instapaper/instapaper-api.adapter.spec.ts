import { InstapaperApiAdapter, InstapaperApiError } from "./instapaper-api.adapter";

describe("InstapaperApiAdapter", () => {
  const adapter = new InstapaperApiAdapter();
  const credentials = { consumerKey: "consumer", consumerSecret: "secret", accessToken: "token", accessTokenSecret: "token-secret" };
  afterEach(() => jest.restoreAllMocks());

  it("signs fixed-origin bounded bookmark requests without exposing secrets", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ bookmarks: [] }), { status: 200 }));
    await expect(adapter.listBookmarks(credentials, { limit: 999, folderId: "unread" })).resolves.toEqual({ bookmarks: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.instapaper.com/api/1/bookmarks/list");
    expect(String(init?.body)).toContain("limit=100");
    expect(String((init?.headers as Record<string, string>).Authorization)).toContain("oauth_signature=");
    expect(String(init?.body)).not.toContain("token-secret");
  });

  it("rejects absolute paths, traversal, and credential-bearing fields", async () => {
    await expect(adapter.request(credentials, "https://evil.example/api/1/bookmarks/list")).rejects.toBeInstanceOf(InstapaperApiError);
    await expect(adapter.request(credentials, "/api/1/../user", {})).rejects.toBeInstanceOf(InstapaperApiError);
    await expect(adapter.request(credentials, "/api/1/bookmarks/add", { password: "nope" })).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("requires a customer-owned Instaparser key for non-personal get_text", async () => {
    await expect(adapter.request(credentials, "/api/1/bookmarks/get_text", { bookmark_id: 1 })).rejects.toMatchObject({ code: "credential_missing" });
  });
});
