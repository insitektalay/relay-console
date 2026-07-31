import { ReflectApiAdapter, ReflectApiError } from "./reflect-api.adapter";

describe("ReflectApiAdapter", () => {
  const adapter = new ReflectApiAdapter();
  afterEach(() => jest.restoreAllMocks());

  it("uses only the fixed Reflect API origin and bearer token", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify([{ id: "graph_1" }]), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(adapter.listBooks("access-secret", { graphId: "graph_1" })).resolves.toEqual([{ id: "graph_1" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://reflect.app/api/graphs/graph_1/books");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer access-secret");
  });

  it("maps a daily-note append to Reflect's required list-append transform", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await adapter.appendDailyNote("access-secret", { graphId: "g_1", text: "Captured", date: "2026-07-13", listName: "Relay" });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ text: "Captured", transform_type: "list-append", date: "2026-07-13", list_name: "Relay" });
  });

  it("blocks credential-bearing bookmark URLs before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    expect(() => adapter.createLink("access-secret", { graphId: "g_1", url: "https://user:pass@example.com/" })).toThrow(ReflectApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
