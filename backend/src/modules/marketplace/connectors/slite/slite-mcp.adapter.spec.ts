import { SliteMcpAdapter, SliteMcpError } from "./slite-mcp.adapter";

const initialize = () => new Response(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { capabilities: { tools: {} } },
  }),
  { status: 200 },
);

describe("SliteMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the Slite MCP origin and calls only an allowlisted read tool", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        result: {
          tools: [{
            name: "search-notes",
            description: "Search notes",
            inputSchema: { type: "object", properties: { query: { type: "string" } } },
          }],
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        result: { content: [{ type: "text", text: "Found one note" }] },
      }), { status: 200 }));

    await expect(new SliteMcpAdapter().callRead("oauth_token", {
      toolName: "search-notes",
      arguments: { query: "onboarding" },
    })).resolves.toEqual({ content: [{ type: "text", text: "Found one note" }] });

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toBe("https://api.slite.com/mcp");
    }
    expect((fetchMock.mock.calls[3][1]?.headers as Record<string, string>).Authorization)
      .toBe("Bearer oauth_token");
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toMatchObject({
      method: "tools/call",
      params: { name: "search-notes", arguments: { query: "onboarding" } },
    });
  });

  it("does not allow mutation tools through the read action", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(new SliteMcpAdapter().callRead("oauth_token", {
      toolName: "archive-note",
      arguments: { noteId: "note_1" },
    })).rejects.toMatchObject<Partial<SliteMcpError>>({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects credential-bearing arguments before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(new SliteMcpAdapter().callWrite("oauth_token", {
      toolName: "create-note",
      arguments: { title: "Guide", apiKey: "do-not-forward" },
    })).rejects.toMatchObject<Partial<SliteMcpError>>({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when a Slite MCP tool schema drifts", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        result: { tools: [{ name: "search-notes", inputSchema: { type: "string" } }] },
      }), { status: 200 }));

    await expect(new SliteMcpAdapter().callRead("oauth_token", {
      toolName: "search-notes",
      arguments: { query: "onboarding" },
    })).rejects.toMatchObject<Partial<SliteMcpError>>({
      code: "provider_validation_error",
    });
  });
});
