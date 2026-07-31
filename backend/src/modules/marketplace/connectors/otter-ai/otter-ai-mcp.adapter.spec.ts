import { OtterAiMcpAdapter, OtterAiMcpError } from "./otter-ai-mcp.adapter";

const initialize = () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { capabilities: { tools: {} } } }), { status: 200 });
const list = () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [
  { name: "get_user_info", inputSchema: { type: "object", properties: {} } },
  { name: "search", inputSchema: { type: "object", properties: { query: { type: "string" } } } },
  { name: "fetch", inputSchema: { type: "object", properties: { id: { type: "string" } } } },
] } }), { status: 200 });

describe("OtterAiMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("pins the hosted MCP and calls only the documented search tool", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(initialize()).mockResolvedValueOnce(new Response(null, { status: 202 })).mockResolvedValueOnce(list()).mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "Meeting result" }] } }), { status: 200 }));
    await expect(new OtterAiMcpAdapter().search("oauth-token", { query: "product decisions" })).resolves.toEqual({ content: [{ type: "text", text: "Meeting result" }] });
    expect(fetchMock.mock.calls.every((call) => String(call[0]) === "https://mcp.otter.ai/mcp")).toBe(true);
    expect((fetchMock.mock.calls[3][1]?.headers as Record<string, string>).Authorization).toBe("Bearer oauth-token");
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual(expect.objectContaining({ method: "tools/call", params: { name: "search", arguments: { query: "product decisions" } } }));
  });
  it("fails closed when the documented tool set drifts", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(initialize()).mockResolvedValueOnce(new Response(null, { status: 202 })).mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "search", inputSchema: { type: "object" } }] } }), { status: 200 }));
    await expect(new OtterAiMcpAdapter().health("oauth-token")).rejects.toMatchObject<Partial<OtterAiMcpError>>({ code: "provider_validation_error" });
  });
  it("rejects empty and oversized typed arguments before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    expect(() => new OtterAiMcpAdapter().search("oauth-token", { query: "" })).toThrow(OtterAiMcpError);
    expect(() => new OtterAiMcpAdapter().fetch("oauth-token", { id: "x".repeat(10001) })).toThrow(OtterAiMcpError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
