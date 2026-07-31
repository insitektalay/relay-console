import { KnowledgeOwlApiAdapter, KnowledgeOwlApiError } from "./knowledgeowl-api.adapter";

describe("KnowledgeOwlApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { projectId: "project-1", apiKey: "fixture" };

  it("pins the official origin, Basic key authentication, project, and list bounds", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await new KnowledgeOwlApiAdapter().listArticles(credentials, { limit: 1000 });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("https://app.knowledgeowl.com/api/head/article.json");
    expect(url).toContain("project_id=project-1"); expect(url).toContain("limit=50");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("fixture:x").toString("base64")}`);
  });

  it("allows only exact current OpenAPI method/path pairs", async () => {
    const adapter = new KnowledgeOwlApiAdapter(); const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await adapter.request(credentials, { method: "DELETE", path: "/article/article-1.json", query: {} });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(adapter.request(credentials, { method: "PATCH", path: "/article/article-1.json" })).rejects.toMatchObject<Partial<KnowledgeOwlApiError>>({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "DELETE", path: "/articlerevision/revision-1.json" })).rejects.toMatchObject<Partial<KnowledgeOwlApiError>>({ code: "provider_validation_error" });
  });

  it("blocks cross-project and credential-bearing input", async () => {
    const adapter = new KnowledgeOwlApiAdapter(); const fetchMock = jest.spyOn(global, "fetch");
    await expect(adapter.request(credentials, { method: "GET", path: "/article.json", query: { project_id: "other" } })).rejects.toMatchObject<Partial<KnowledgeOwlApiError>>({ code: "policy_blocked" });
    await expect(adapter.request(credentials, { method: "POST", path: "/article.json", json: { api_key: "leak" } })).rejects.toMatchObject<Partial<KnowledgeOwlApiError>>({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds uploads and maps provider rate limits safely", async () => {
    const adapter = new KnowledgeOwlApiAdapter();
    await expect(adapter.uploadFile(credentials, { filename: "../secret", fileBase64: "YQ==" })).rejects.toMatchObject<Partial<KnowledgeOwlApiError>>({ code: "provider_validation_error" });
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Slow down" }), { status: 429 }));
    await expect(adapter.listCategories(credentials)).rejects.toMatchObject<Partial<KnowledgeOwlApiError>>({ code: "provider_rate_limited", statusCode: 429 });
  });
});
