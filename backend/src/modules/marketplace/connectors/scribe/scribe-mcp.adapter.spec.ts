import { ScribeMcpAdapter, ScribeMcpError } from "./scribe-mcp.adapter";

const initialize = () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { capabilities: { tools: {} } } }), { status: 200 });
const tools = (items: unknown[]) => new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: items } }), { status: 200 });

describe("ScribeMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the hosted MCP origin and calls a discovered read-only tool", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(initialize()).mockResolvedValueOnce(new Response(null, { status: 202 })).mockResolvedValueOnce(tools([{ name: "search_documents", description: "Search documents", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } }])).mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "Found" }] } }), { status: 200 }));
    await expect(new ScribeMcpAdapter().callRead("oauth", { toolName: "search_documents", arguments: { query: "onboarding" } })).resolves.toEqual({ content: [{ type: "text", text: "Found" }] });
    expect(fetchMock.mock.calls.every((call) => String(call[0]) === "https://mcp.scribe.com/mcp")).toBe(true);
  });

  it("fails closed for destructive or mutating discovered tools", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(initialize()).mockResolvedValueOnce(new Response(null, { status: 202 })).mockResolvedValueOnce(tools([{ name: "delete_document", description: "Delete a document", inputSchema: { type: "object" }, annotations: { destructiveHint: true } }]));
    await expect(new ScribeMcpAdapter().callRead("oauth", { toolName: "delete_document", arguments: {} })).rejects.toMatchObject<Partial<ScribeMcpError>>({ code: "policy_blocked" });
  });

  it("rejects credential-bearing arguments before tool execution", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(initialize()).mockResolvedValueOnce(new Response(null, { status: 202 })).mockResolvedValueOnce(tools([{ name: "search_documents", description: "Search documents", inputSchema: { type: "object" } }]));
    await expect(new ScribeMcpAdapter().callRead("oauth", { toolName: "search_documents", arguments: { apiKey: "no" } })).rejects.toMatchObject<Partial<ScribeMcpError>>({ code: "policy_blocked" });
  });

  it("requires at least one verifiably non-mutating MCP tool at health", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(initialize()).mockResolvedValueOnce(new Response(null, { status: 202 })).mockResolvedValueOnce(tools([{ name: "update_document", description: "Update document", inputSchema: { type: "object" }, annotations: { readOnlyHint: false } }]));
    await expect(new ScribeMcpAdapter().health("oauth")).rejects.toMatchObject<Partial<ScribeMcpError>>({ code: "provider_validation_error" });
  });
});
