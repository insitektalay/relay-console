import { FrameIoApiAdapter, FrameIoApiError } from "./frame-io-api.adapter";

describe("FrameIoApiAdapter", () => {
  const api = new FrameIoApiAdapter();
  afterEach(() => jest.restoreAllMocks());

  it("pins bounded project reads to the stable Frame.io V4 origin", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await api.listProjects("secret-token", { accountId: "acc-1", workspaceId: "work-1", pageSize: 25, after: "cursor" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.frame.io/v4/accounts/acc-1/workspaces/work-1/projects?page_size=25&after=cursor");
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });

  it("rejects alternate origins and credential-bearing payloads", async () => {
    await expect(api.request("token", { method: "GET", path: "https://evil.invalid/v4/me" })).rejects.toBeInstanceOf(FrameIoApiError);
    await expect(api.request("token", { method: "POST", path: "/v4/accounts/a/projects", json: { access_token: "leak" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts passphrases and pre-signed media URLs", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ passphrase: "secret", upload_urls: ["signed"], view_url: "https://next.frame.io/file" }), { status: 200 }));
    await expect(api.getMe("token")).resolves.toEqual({ passphrase: "[redacted]", upload_urls: "[redacted]", view_url: "https://next.frame.io/file" });
  });

  it("uses the documented bounded POST search contract", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await api.search("token", { accountId: "acc-1", query: "rough cut", engine: "nlp", pageSize: 10 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.frame.io/v4/accounts/acc-1/search?page_size=10");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify({ query: "rough cut", engine: "nlp" }));
  });
});
