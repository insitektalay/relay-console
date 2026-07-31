import { LucidchartApiAdapter, LucidchartApiError } from "./lucidchart-api.adapter";

describe("LucidchartApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses Lucid's fixed origin and forces document searches to Lucidchart", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ documents: [{ id: "diagram_1", product: "lucidchart", title: "Workshop" }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(new LucidchartApiAdapter().callRead("oauth-token", { path: "/v1/documents/search", json: { keywords: "workshop", product: ["lucidchart"] } })).resolves.toMatchObject({ documents: [{ product: "lucidchart" }] });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.lucid.co/v1/documents/search");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ product: ["lucidchart"] });
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>)["Lucid-Api-Version"]).toBe("1");
  });

  it("preflights diagram mutations and allows only Lucidchart resources", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "diagram_1", product: "lucidchart" }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "diagram_1", product: "lucidchart", title: "Renamed" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(new LucidchartApiAdapter().callWrite("oauth-token", { method: "PATCH", path: "/v1/documents/diagram_1", json: { title: "Renamed" } })).resolves.toMatchObject({ product: "lucidchart" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
  });

  it("rejects non-Lucidchart documents, unknown routes, and credential-bearing input", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "board_1", product: "lucidspark" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const adapter = new LucidchartApiAdapter();
    await expect(adapter.callRead("oauth-token", { path: "/v1/documents/diagram_1" })).rejects.toMatchObject<Partial<LucidchartApiError>>({ code: "provider_validation_error" });
    await expect(adapter.callRead("oauth-token", { path: "https://evil.example/v1/documents" })).rejects.toMatchObject<Partial<LucidchartApiError>>({ code: "provider_validation_error" });
    await expect(adapter.callWrite("oauth-token", { method: "POST", path: "/v1/documents", json: { accessToken: "leak" } })).rejects.toMatchObject<Partial<LucidchartApiError>>({ code: "policy_blocked" });
  });
});
