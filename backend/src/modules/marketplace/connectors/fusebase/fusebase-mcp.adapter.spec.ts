import { FuseBaseMcpAdapter, FuseBaseMcpError } from "./fusebase-mcp.adapter";

describe("FuseBaseMcpAdapter", () => {
  const credentials = {
    url: "https://app.thefusebase.com/mcp/relay",
    token: "customer-token",
  };

  it("initializes and lists bounded provider tools without exposing the token", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "FuseBase", version: "1" } } }, { "mcp-session-id": "session-1" }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "notes_list", description: "List notes", inputSchema: { type: "object" } }] } }));
    const result = await new FuseBaseMcpAdapter(fetchMock as unknown as typeof fetch).listTools(credentials);
    expect(result).toEqual([{ name: "notes_list", description: "List notes", inputSchema: { type: "object" } }]);
    expect(fetchMock.mock.calls[2][1].headers["Mcp-Session-Id"]).toBe("session-1");
    expect(JSON.stringify(result)).not.toContain("customer-token");
  });

  it("rejects non-official and non-HTTPS MCP endpoints before fetch", async () => {
    const fetchMock = jest.fn();
    await expect(new FuseBaseMcpAdapter(fetchMock as unknown as typeof fetch).health({ ...credentials, url: "http://127.0.0.1:3000/mcp" })).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks mutating names and credential-bearing arguments from the read wrapper", async () => {
    const adapter = new FuseBaseMcpAdapter(jest.fn() as unknown as typeof fetch);
    await expect(adapter.callReadTool(credentials, { toolName: "notes_delete", arguments: {} })).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(adapter.callReadTool(credentials, { toolName: "notes_list", arguments: { apiKey: "secret" } })).rejects.toBeInstanceOf(FuseBaseMcpError);
  });

  it("calls a discovered full-authority tool and redacts secret-shaped result fields", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: 1, result: { capabilities: { tools: {} } } }, { "mcp-session-id": "s" }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "notes_create" }] } }))
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "created" }], accessToken: "never-return" } }));
    const result = await new FuseBaseMcpAdapter(fetchMock as unknown as typeof fetch).callTool(credentials, { toolName: "notes_create", arguments: { title: "Plan" } });
    expect(result).toMatchObject({ accessToken: "[redacted]" });
  });
});

function json(value: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json", ...headers } });
}
