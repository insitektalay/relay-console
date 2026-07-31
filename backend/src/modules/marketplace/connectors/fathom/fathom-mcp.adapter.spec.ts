import { FathomMcpAdapter, FathomMcpError } from "./fathom-mcp.adapter";

const initialize = () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { capabilities: { tools: {} } } }), { status: 200 });
const list = () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [
  "list_meetings", "get_summary", "get_transcript", "list_teams", "list_team_members", "create_webhook", "delete_webhook",
].map((name) => ({ name, inputSchema: { type: "object" } })) } }), { status: 200 });

describe("FathomMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("pins the official MCP and invokes an exact documented read tool", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(initialize()).mockResolvedValueOnce(new Response(null, { status: 202 })).mockResolvedValueOnce(list()).mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "summary" }] } }), { status: 200 }));
    await expect(new FathomMcpAdapter().callRead("oauth-token", { toolName: "get_summary", arguments: { recording_id: "rec-1" } })).resolves.toEqual({ content: [{ type: "text", text: "summary" }] });
    expect(fetchMock.mock.calls.every((call) => String(call[0]) === "https://api.fathom.ai/mcp")).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual(expect.objectContaining({ method: "tools/call", params: { name: "get_summary", arguments: { recording_id: "rec-1" } } }));
  });
  it("blocks cross-policy calls and non-public webhook destinations", async () => {
    const adapter = new FathomMcpAdapter();
    await expect(adapter.callRead("oauth-token", { toolName: "delete_webhook", arguments: {} })).rejects.toMatchObject<Partial<FathomMcpError>>({ code: "policy_blocked" });
    await expect(adapter.callWrite("oauth-token", { toolName: "create_webhook", arguments: { destination_url: "http://127.0.0.1/hook" } })).rejects.toMatchObject<Partial<FathomMcpError>>({ code: "policy_blocked" });
  });
  it("fails closed when the documented seven-tool set drifts", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(initialize()).mockResolvedValueOnce(new Response(null, { status: 202 })).mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "list_meetings", inputSchema: { type: "object" } }] } }), { status: 200 }));
    await expect(new FathomMcpAdapter().health("oauth-token")).rejects.toMatchObject<Partial<FathomMcpError>>({ code: "provider_validation_error" });
  });
});
