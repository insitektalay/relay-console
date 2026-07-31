import { MazeMcpAdapter, MazeMcpError } from "./maze-mcp.adapter";

describe("MazeMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("discovers and invokes only read-only tools over the official MCP", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { capabilities: { tools: {} } },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              tools: [
                {
                  name: "search_studies",
                  description: "Search studies",
                  inputSchema: { type: "object" },
                  annotations: { readOnlyHint: true },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            result: { content: [{ type: "text", text: "research result" }] },
          }),
          { status: 200 },
        ),
      );
    const result = await new MazeMcpAdapter().callRead("oauth-token", {
      toolName: "search_studies",
      arguments: { query: "checkout" },
    });
    expect(
      fetchSpy.mock.calls.every(
        ([url]) => url === "https://connect.maze.co/mcp",
      ),
    ).toBe(true);
    expect(fetchSpy.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-token",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      content: [{ type: "text", text: "research result" }],
    });
  });

  it("blocks mutating and credential-bearing calls before network access", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    await expect(
      new MazeMcpAdapter().callRead("oauth-token", {
        toolName: "delete_study",
        arguments: {},
      }),
    ).rejects.toBeInstanceOf(MazeMcpError);
    await expect(
      new MazeMcpAdapter().callRead("oauth-token", {
        toolName: "search_studies",
        arguments: { apiToken: "private" },
      }),
    ).rejects.toBeInstanceOf(MazeMcpError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
