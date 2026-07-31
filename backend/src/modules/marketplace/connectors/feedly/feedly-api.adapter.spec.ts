import { FeedlyApiAdapter, FeedlyApiError } from "./feedly-api.adapter";

describe("FeedlyApiAdapter", () => {
  const adapter = new FeedlyApiAdapter();
  const credentials = { accessToken: "customer-token" };
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it("keeps bounded article reads on api.feedly.com", async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    await adapter.collectArticles(credentials, { streamId: "enterprise/acme/category/news", count: 999 });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.origin).toBe("https://api.feedly.com");
    expect(url.pathname).toBe("/v3/streams/contents");
    expect(url.searchParams.get("count")).toBe("100");
    expect(init.headers).toMatchObject({ Authorization: "Bearer customer-token" });
  });

  it("rejects absolute, traversal, and credential-bearing requests", async () => {
    await expect(adapter.request(credentials, { method: "GET", path: "https://evil.example/v3/profile" })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "GET", path: "/v3/../profile" })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "POST", path: "/v3/search/contents", json: { apiKey: "nope" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps provider limits to a safe error without exposing tokens", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ errorMessage: "API rate limit reached", accessToken: "leak" }), { status: 429 })) as typeof fetch;
    await expect(adapter.profile(credentials)).rejects.toEqual(expect.objectContaining<Partial<FeedlyApiError>>({ code: "provider_rate_limited", message: "API rate limit reached" }));
  });
});
