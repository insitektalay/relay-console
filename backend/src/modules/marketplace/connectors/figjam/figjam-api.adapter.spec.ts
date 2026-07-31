import { FigJamApiAdapter, FigJamApiError } from "./figjam-api.adapter";

describe("FigJamApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the fixed Figma origin for bounded FigJam reads", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      name: "Workshop",
      editorType: "figjam",
      document: { id: "0:0", type: "DOCUMENT", children: [] },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(new FigJamApiAdapter().callRead("oauth-token", {
      path: "/v1/files/board_123",
      query: { depth: 2 },
    })).resolves.toMatchObject({ editorType: "figjam" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.figma.com/v1/files/board_123?depth=2");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer oauth-token");
  });

  it("allows documented comment and webhook mutations only", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ file: { editorType: "figjam" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "comment_1" }), { status: 200 }));
    await expect(new FigJamApiAdapter().callWrite("oauth-token", {
      method: "POST",
      path: "/v1/files/board_123/comments",
      json: { message: "Ready for review" },
    })).resolves.toMatchObject({ id: "comment_1" });
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    await expect(new FigJamApiAdapter().callWrite("oauth-token", {
      method: "POST",
      path: "/v1/files/board_123/nodes",
      json: { type: "STICKY" },
    })).rejects.toMatchObject<Partial<FigJamApiError>>({ code: "provider_validation_error" });
  });

  it("rejects non-FigJam files, absolute URLs, and credential-bearing input", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ editorType: "figma" }), { status: 200 }));
    const adapter = new FigJamApiAdapter();
    await expect(adapter.callRead("oauth-token", { path: "/v1/files/design_123" })).rejects.toMatchObject<Partial<FigJamApiError>>({ code: "provider_validation_error" });
    await expect(adapter.callRead("oauth-token", { path: "https://evil.example/v1/me" })).rejects.toMatchObject<Partial<FigJamApiError>>({ code: "provider_validation_error" });
    await expect(adapter.callWrite("oauth-token", { method: "POST", path: "/v2/webhooks", json: { accessToken: "leak" } })).rejects.toMatchObject<Partial<FigJamApiError>>({ code: "policy_blocked" });
  });
});
