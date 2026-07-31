import { NuclinoMcpAdapter, NuclinoMcpError } from "./nuclino-mcp.adapter";

const initialize = () => new Response(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  result: { capabilities: { tools: {} } },
}), { status: 200 });

describe("NuclinoMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the Nuclino MCP origin and calls only an allowlisted read tool", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        result: { tools: [{ name: "search_items", inputSchema: { type: "object", properties: { query: { type: "string" } } } }] },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        result: { content: [{ type: "text", text: "Found one item" }] },
      }), { status: 200 }));

    await expect(new NuclinoMcpAdapter().callRead("oauth_token", {
      toolName: "search_items",
      arguments: { query: "onboarding" },
    })).resolves.toEqual({ content: [{ type: "text", text: "Found one item" }] });

    for (const call of fetchMock.mock.calls) expect(String(call[0])).toBe("https://api.nuclino.com/mcp");
    expect((fetchMock.mock.calls[3][1]?.headers as Record<string, string>).Authorization).toBe("Bearer oauth_token");
  });

  it("does not allow mutation tools through the read action", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(new NuclinoMcpAdapter().callRead("oauth_token", {
      toolName: "delete_item",
      arguments: { itemId: "item_1" },
    })).rejects.toMatchObject<Partial<NuclinoMcpError>>({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects credential-bearing arguments before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(new NuclinoMcpAdapter().callWrite("oauth_token", {
      toolName: "create_item",
      arguments: { title: "Guide", apiKey: "do-not-forward" },
    })).rejects.toMatchObject<Partial<NuclinoMcpError>>({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when a Nuclino MCP tool schema drifts", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        result: { tools: [{ name: "search_items", inputSchema: { type: "string" } }] },
      }), { status: 200 }));
    await expect(new NuclinoMcpAdapter().callRead("oauth_token", {
      toolName: "search_items",
      arguments: { query: "onboarding" },
    })).rejects.toMatchObject<Partial<NuclinoMcpError>>({ code: "provider_validation_error" });
  });
});
