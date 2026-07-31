import { DescriptApiAdapter, DescriptApiError } from "./descript-api.adapter";

describe("DescriptApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { apiToken: "fixture-token" };
  it("pins the official origin, injects Bearer auth, and bounds project lists", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    await new DescriptApiAdapter().listProjects(credentials, { limit: 1000 });
    const [request, init] = fetchMock.mock.calls[0]; const url = new URL(String(request));
    expect(url.origin + url.pathname).toBe("https://descriptapi.com/v1/projects"); expect(url.searchParams.get("limit")).toBe("20"); expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer fixture-token");
  });
  it("blocks alternate paths and caller-supplied credentials", async () => {
    const adapter = new DescriptApiAdapter();
    await expect(adapter.request(credentials, { method: "GET", path: "/../oauth" })).rejects.toMatchObject<Partial<DescriptApiError>>({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "POST", path: "/jobs/agent", json: { api_token: "stolen" } })).rejects.toMatchObject<Partial<DescriptApiError>>({ code: "policy_blocked" });
  });
  it("redacts signed transfer URLs and token-shaped response fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ api_token: "secret", upload_url: "https://signed.example", project_url: "https://web.descript.com/p" }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(new DescriptApiAdapter().importMedia(credentials, { project_name: "Test" })).resolves.toEqual({ api_token: "[redacted]", upload_url: "[redacted]", project_url: "https://web.descript.com/p" });
  });
});
