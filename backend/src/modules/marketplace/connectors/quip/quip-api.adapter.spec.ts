import { QuipApiAdapter } from "./quip-api.adapter";

describe("QuipApiAdapter", () => {
  const api = new QuipApiAdapter(); afterEach(() => jest.restoreAllMocks());
  it("routes bounded reads only to the fixed Automation API origin", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ threads: {} }), { status: 200, headers: { "content-type": "application/json" } }));
    await api.listThreads("token", { limit: 25 }); const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://platform.quip.com/1/users/current/threads?limit=25"); expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token");
  });
  it("rejects OAuth, paid Admin, traversal, and credential-bearing requests", async () => {
    for (const path of ["/1/oauth/revoke", "/1/admin/events", "/1/threads/../users/current"]) await expect(api.request("token", { method: "GET", path })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(api.request("token", { method: "POST", path: "/1/threads/new-document", form: { clientSecret: "no" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });
  it("returns bounded binary exports as base64 and maps rate limits safely", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "application/pdf" } }));
    await expect(api.request("token", { method: "GET", path: "/1/threads/abc123/export/pdf" })).resolves.toMatchObject({ mimeType: "application/pdf", fileBase64: "AQID", byteLength: 3 });
    jest.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ error_description: "slow" }), { status: 429, headers: { "content-type": "application/json" } }));
    await expect(api.getCurrentUser("token")).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
