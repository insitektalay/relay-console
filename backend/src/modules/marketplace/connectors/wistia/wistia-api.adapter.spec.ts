import { WistiaApiAdapter, WistiaApiError } from "./wistia-api.adapter";

describe("WistiaApiAdapter", () => {
  const api = new WistiaApiAdapter();
  afterEach(() => jest.restoreAllMocks());

  it("pins bounded media reads to the versioned Wistia API", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await api.listMedia("secret-token", { page: 2, perPage: 25, folderId: "abc123" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.wistia.com/modern/medias?page=2&per_page=25&folder_id=abc123");
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect((options?.headers as Record<string, string>)["X-Wistia-API-Version"]).toBe("2026-05");
  });

  it("rejects alternate origins and credential-bearing payloads", async () => {
    await expect(api.request("token", { method: "GET", path: "https://evil.invalid/modern/account" })).rejects.toBeInstanceOf(WistiaApiError);
    await expect(api.request("token", { method: "POST", path: "/modern/medias", json: { access_token: "leak" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("supports bounded remote URL imports only on the fixed upload origin", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ hashed_id: "abc123" }), { status: 200 }));
    await api.request("token", { origin: "upload", method: "POST", path: "/", json: { url: "https://media.example/video.mp4", name: "Demo" } });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://upload.wistia.com/");
    expect(options?.body).toBe("url=https%3A%2F%2Fmedia.example%2Fvideo.mp4&name=Demo");
  });

  it("redacts provider credentials in responses", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ api_token: "leak", name: "account" }), { status: 200 }));
    await expect(api.getAccount("token")).resolves.toEqual({ api_token: "[redacted]", name: "account" });
  });
});
