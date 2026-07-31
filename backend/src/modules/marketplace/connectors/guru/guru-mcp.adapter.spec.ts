import { GuruMcpAdapter, GuruMcpError } from "./guru-mcp.adapter";

describe("GuruMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the Guru MCP origin and calls only a documented typed capability", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { capabilities: { tools: {} } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "list_knowledge_agents", description: "List Knowledge Agents", inputSchema: { type: "object", properties: {} } }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "Agent One" }] } }), { status: 200 }));
    await expect(new GuruMcpAdapter().listAgents("oauth_token")).resolves.toEqual({ content: [{ type: "text", text: "Agent One" }] });
    for (const call of fetchMock.mock.calls) expect(String(call[0])).toBe("https://mcp.api.getguru.com/mcp");
    expect((fetchMock.mock.calls[3][1]?.headers as Record<string, string>).Authorization).toBe("Bearer oauth_token");
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toMatchObject({ method: "tools/call", params: { name: "list_knowledge_agents", arguments: {} } });
  });

  it("fails closed when Guru MCP tool schema drifts", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { capabilities: { tools: {} } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "list_knowledge_agents", inputSchema: { type: "string" } }] } }), { status: 200 }));
    await expect(new GuruMcpAdapter().listAgents("oauth_token")).rejects.toMatchObject<Partial<GuruMcpError>>({ code: "provider_validation_error" });
  });
});
