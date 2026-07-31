import {
  AtlassianRovoMcpAdapter,
  AtlassianRovoMcpError,
} from "./atlassian-rovo-mcp.adapter";

describe("AtlassianRovoMcpAdapter", () => {
  it("uses the fixed Atlassian endpoint, bearer auth, and bounds tool discovery", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        response(
          { jsonrpc: "2.0", id: 1, result: { capabilities: { tools: {} } } },
          { "mcp-session-id": "session-1" },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        response({
          jsonrpc: "2.0",
          id: 2,
          result: { tools: [{ name: "search_jira", description: "Search" }] },
        }),
      );
    const adapter = new AtlassianRovoMcpAdapter(fetchMock as typeof fetch);

    await expect(
      adapter.listTools({ serviceAccountApiKey: "test-key" }),
    ).resolves.toEqual([
      { name: "search_jira", description: "Search", inputSchema: {} },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("https://mcp.atlassian.com/v1/mcp");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer test-key",
    );
  });

  it("blocks mutation-shaped names from the read wrapper", async () => {
    const adapter = new AtlassianRovoMcpAdapter(
      jest.fn() as unknown as typeof fetch,
    );
    await expect(
      adapter.callReadTool(
        { serviceAccountApiKey: "test-key" },
        { toolName: "update_jira_issue" },
      ),
    ).rejects.toMatchObject<Partial<AtlassianRovoMcpError>>({
      code: "policy_blocked",
      statusCode: 403,
    });
  });
});

function response(value: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
