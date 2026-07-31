import { VimeoApiAdapter, VimeoApiError } from "./vimeo-api.adapter";

describe("VimeoApiAdapter", () => {
  const api = new VimeoApiAdapter();
  afterEach(() => jest.restoreAllMocks());

  it("pins bounded reads to api.vimeo.com with the bearer token", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await api.listVideos("secret-token", { page: 2, perPage: 25, query: "demo" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.vimeo.com/me/videos?page=2&per_page=25&query=demo");
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });

  it("rejects absolute URLs and credential-bearing payloads", async () => {
    await expect(api.request("token", { method: "GET", path: "https://evil.invalid/me" })).rejects.toBeInstanceOf(VimeoApiError);
    await expect(api.request("token", { method: "POST", path: "/me/videos", json: { access_token: "leak" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts provider credentials in responses", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ access_token: "leak", name: "video" }), { status: 200 }));
    await expect(api.getMe("token")).resolves.toEqual({ access_token: "[redacted]", name: "video" });
  });
});
