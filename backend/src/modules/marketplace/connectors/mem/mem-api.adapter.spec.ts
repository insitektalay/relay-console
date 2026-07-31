import { MemApiAdapter, MemApiError } from "./mem-api.adapter";

describe("MemApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { apiKey: "mem_customer_key" };

  it("uses only the fixed Mem origin and does not place credentials in the payload", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    await new MemApiAdapter().searchNotes(credentials, { query: "roadmap", limit: 20 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.mem.ai/v2/notes/search");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer mem_customer_key");
    expect(String(init?.body)).not.toContain("mem_customer_key");
  });

  it("rejects absolute paths traversal and credential-bearing fields", async () => {
    const adapter = new MemApiAdapter();
    await expect(adapter.request(credentials, { method: "GET", path: "https://evil.test/v2/notes" })).rejects.toBeInstanceOf(MemApiError);
    await expect(adapter.request(credentials, { method: "GET", path: "/v2/../admin" })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "POST", path: "/v2/notes", json: { apiKey: "leak" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("bounds list input and redacts secret-shaped provider fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ results: [{ id: "note", access_token: "hidden" }] }), { status: 200 }));
    const result = await new MemApiAdapter().listNotes(credentials, { limit: 999 });
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=100");
    expect(result).toMatchObject({ data: { results: [{ access_token: "[redacted]" }] } });
  });
});
