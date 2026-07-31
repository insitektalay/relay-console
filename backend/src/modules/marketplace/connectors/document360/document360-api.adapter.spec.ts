import { Document360ApiAdapter, Document360ApiError } from "./document360-api.adapter";

describe("Document360ApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { apiToken: "fixture", apiOrigin: "https://apihub.us.document360.io" };

  it("pins an official API Hub origin and uses only the api_token header", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
    await new Document360ApiAdapter().listWorkspaces(credentials);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://apihub.us.document360.io/v2/ProjectVersions");
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.api_token).toBe("fixture");
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain("Authorization");
  });

  it("bounds article lists and suppresses SAS-token expansion on reads", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    const adapter = new Document360ApiAdapter();
    await adapter.listArticles(credentials, { projectVersionId: "workspace-1", hitsPerPage: 1000 });
    await adapter.getArticle(credentials, { articleId: "article-1", languageCode: "en" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("hitsPerPage=50");
    expect(String(fetchMock.mock.calls[1][0])).toContain("appendSASToken=false");
    expect(String(fetchMock.mock.calls[1][0])).toContain("isForDisplay=false");
  });

  it("rejects alternate origins, traversal, and credential-bearing inputs", async () => {
    const adapter = new Document360ApiAdapter();
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(adapter.listWorkspaces({ apiToken: "fixture", apiOrigin: "https://evil.example" })).rejects.toMatchObject<Partial<Document360ApiError>>({ code: "policy_blocked" });
    await expect(adapter.request(credentials, { method: "GET", path: "/v2/../secrets" })).rejects.toMatchObject<Partial<Document360ApiError>>({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "POST", path: "/v2/Articles", json: { api_token: "leak" } })).rejects.toMatchObject<Partial<Document360ApiError>>({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps provider rate limits to a safe error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ errors: [{ description: "Rate limited" }] }), { status: 429 }));
    await expect(new Document360ApiAdapter().listWorkspaces(credentials)).rejects.toMatchObject<Partial<Document360ApiError>>({ code: "provider_rate_limited", statusCode: 429 });
  });
});
