import { FirefliesAiMcpAdapter, FirefliesAiMcpError } from "./fireflies-ai-mcp.adapter";

const initialize = () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { capabilities: { tools: {} } } }), { status: 200 });
const list = () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [
  { name: "fireflies_get_transcripts", inputSchema: { type: "object" } },
  { name: "fireflies_get_transcript", inputSchema: { type: "object" } },
  { name: "fireflies_get_summary", inputSchema: { type: "object" } },
  { name: "fireflies_share_meeting", inputSchema: { type: "object" } },
  { name: "fireflies_create_soundbite", inputSchema: { type: "object" } },
] } }), { status: 200 });

describe("FirefliesAiMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the hosted MCP and invokes an exact documented read tool", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(list())
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "meeting" }] } }), { status: 200 }));
    await expect(new FirefliesAiMcpAdapter().callRead("oauth-token", {
      toolName: "fireflies_get_transcript",
      arguments: { transcriptId: "meeting-1" },
    })).resolves.toEqual({ content: [{ type: "text", text: "meeting" }] });
    expect(fetchMock.mock.calls.every((call) => String(call[0]) === "https://api.fireflies.ai/mcp")).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual(expect.objectContaining({
      method: "tools/call",
      params: { name: "fireflies_get_transcript", arguments: { transcriptId: "meeting-1" } },
    }));
  });

  it("fails closed for cross-policy tools and credential-bearing arguments", async () => {
    const adapter = new FirefliesAiMcpAdapter();
    await expect(adapter.callRead("oauth-token", { toolName: "fireflies_share_meeting", arguments: {} }))
      .rejects.toMatchObject<Partial<FirefliesAiMcpError>>({ code: "policy_blocked" });
    await expect(adapter.callWrite("oauth-token", { toolName: "fireflies_share_meeting", arguments: { apiKey: "never" } }))
      .rejects.toMatchObject<Partial<FirefliesAiMcpError>>({ code: "policy_blocked" });
  });

  it("fails closed when the documented tool set drifts", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "fireflies_get_transcripts", inputSchema: { type: "object" } }] } }), { status: 200 }));
    await expect(new FirefliesAiMcpAdapter().health("oauth-token"))
      .rejects.toMatchObject<Partial<FirefliesAiMcpError>>({ code: "provider_validation_error" });
  });
});
