import { LucidsparkApiAdapter, LucidsparkApiError } from "./lucidspark-api.adapter";

describe("LucidsparkApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses Lucid's fixed origin and forces document searches to Lucidspark", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ documents: [{ id: "board_1", product: "lucidspark", title: "Workshop" }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(new LucidsparkApiAdapter().callRead("oauth-token", { path: "/v1/documents/search", json: { keywords: "workshop", product: ["lucidchart"] } })).resolves.toMatchObject({ documents: [{ product: "lucidspark" }] });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.lucid.co/v1/documents/search");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ product: ["lucidspark"] });
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>)["Lucid-Api-Version"]).toBe("1");
  });

  it("preflights board mutations and allows only Lucidspark resources", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "board_1", product: "lucidspark" }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "board_1", product: "lucidspark", title: "Renamed" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(new LucidsparkApiAdapter().callWrite("oauth-token", { method: "PATCH", path: "/v1/documents/board_1", json: { title: "Renamed" } })).resolves.toMatchObject({ product: "lucidspark" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
  });

  it("rejects non-Lucidspark documents, unknown routes, and credential-bearing input", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "diagram_1", product: "lucidchart" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const adapter = new LucidsparkApiAdapter();
    await expect(adapter.callRead("oauth-token", { path: "/v1/documents/diagram_1" })).rejects.toMatchObject<Partial<LucidsparkApiError>>({ code: "provider_validation_error" });
    await expect(adapter.callRead("oauth-token", { path: "https://evil.example/v1/documents" })).rejects.toMatchObject<Partial<LucidsparkApiError>>({ code: "provider_validation_error" });
    await expect(adapter.callWrite("oauth-token", { method: "POST", path: "/v1/documents", json: { accessToken: "leak" } })).rejects.toMatchObject<Partial<LucidsparkApiError>>({ code: "policy_blocked" });
  });
});
