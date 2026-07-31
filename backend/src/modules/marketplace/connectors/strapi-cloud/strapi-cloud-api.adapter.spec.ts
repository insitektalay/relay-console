import { StrapiCloudApiAdapter, StrapiCloudApiError } from "./strapi-cloud-api.adapter";

describe("StrapiCloudApiAdapter", () => {
  const api = new StrapiCloudApiAdapter();
  const credentials = {
    instanceUrl: "https://relay-demo.strapiapp.com",
    allowedApiIds: "articles, authors",
    apiToken: "strapi-token",
  };

  afterEach(() => jest.restoreAllMocks());

  it("uses the exact Strapi Cloud origin, bearer token, bounded pagination, and no redirect", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [], meta: {} }), { status: 200 }));
    await api.listDocuments(credentials, { pluralApiId: "articles", page: 2, pageSize: 25, status: "draft", locale: "en-GB" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://relay-demo.strapiapp.com/api/articles?pagination%5Bpage%5D=2&pagination%5BpageSize%5D=25&status=draft&locale=en-GB");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer strapi-token");
    expect(init?.redirect).toBe("error");
  });

  it.each([
    "http://relay-demo.strapiapp.com",
    "https://relay-demo.strapiapp.com.evil.example",
    "https://127.0.0.1",
    "https://relay-demo.strapiapp.com:8443",
    "https://user:pass@relay-demo.strapiapp.com",
    "https://relay-demo.strapiapp.com/admin",
  ])("rejects a non-exact Strapi Cloud project origin: %s", (instanceUrl) => {
    expect(() => api.listConfiguredContentTypes({ ...credentials, instanceUrl })).toThrow(StrapiCloudApiError);
  });

  it("binds requests to the configured plural API IDs", async () => {
    expect(() => api.listDocuments(credentials, { pluralApiId: "products" })).toThrow(expect.objectContaining({ code: "policy_blocked" }));
    expect(api.listConfiguredContentTypes(credentials)).toEqual({ pluralApiIds: ["articles", "authors"], providerSideEffect: false });
  });

  it("creates drafts with the Strapi 5 data envelope and draft status", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { documentId: "doc1", publishedAt: null } }), { status: 200 }));
    await api.createDraft(credentials, { pluralApiId: "articles", fields: { title: "Draft" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://relay-demo.strapiapp.com/api/articles?status=draft");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ data: { title: "Draft" } });
  });

  it("preflights the exact draft updatedAt before an update", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { documentId: "doc1", updatedAt: "2026-07-16T12:00:00.000Z", publishedAt: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { documentId: "doc1" } }), { status: 200 }));
    await api.updateDraft(credentials, { pluralApiId: "articles", documentId: "doc1", expectedUpdatedAt: "2026-07-16T12:00:00.000Z", fields: { title: "Updated" } });
    expect(String(fetchMock.mock.calls[0][0])).toContain("status=draft");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PUT");
  });

  it("rejects stale writes and reserved or credential-bearing fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { documentId: "doc1", updatedAt: "2026-07-16T12:01:00.000Z", publishedAt: null } }), { status: 200 }));
    await expect(api.updateDraft(credentials, { pluralApiId: "articles", documentId: "doc1", expectedUpdatedAt: "2026-07-16T12:00:00.000Z", fields: { title: "Updated" } })).rejects.toMatchObject({ code: "approval_mismatch" });
    expect(() => api.createDraft(credentials, { pluralApiId: "articles", fields: { updatedAt: "x" } })).toThrow(expect.objectContaining({ code: "policy_blocked" }));
    expect(() => api.createDraft(credentials, { pluralApiId: "articles", fields: { apiToken: "x" } })).toThrow(expect.objectContaining({ code: "policy_blocked" }));
  });

  it("publishes through an explicit published-status write after draft preflight", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { documentId: "doc1", updatedAt: "2026-07-16T12:00:00.000Z", publishedAt: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { documentId: "doc1", publishedAt: "2026-07-16T12:02:00.000Z" } }), { status: 200 }));
    await api.publishDocument(credentials, { pluralApiId: "articles", documentId: "doc1", expectedUpdatedAt: "2026-07-16T12:00:00.000Z" });
    expect(String(fetchMock.mock.calls[1][0])).toContain("status=published");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ data: {} });
  });

  it("normalizes and hashes a change without provider side effects", () => {
    const result = api.prepareDocumentChange(credentials, { operation: "create_draft", pluralApiId: "articles", fields: { title: "Draft" } });
    expect(result).toEqual(expect.objectContaining({ operation: "create_draft", pluralApiId: "articles", providerSideEffect: false, payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  });
});
