import { LookbackMcpAdapter, LookbackMcpError } from "./lookback-mcp.adapter";

describe("LookbackMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("discovers and invokes only verified read-only tools", async () => {
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
                  name: "list_projects",
                  description: "List projects",
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
            result: { content: [{ type: "text", text: "projects" }] },
          }),
          { status: 200 },
        ),
      );
    expect(
      await new LookbackMcpAdapter().callRead("oauth-token", {
        toolName: "list_projects",
        arguments: {},
      }),
    ).toEqual({ content: [{ type: "text", text: "projects" }] });
    expect(
      fetchSpy.mock.calls.every(
        ([url]) => url === "https://mcp.lookback.io/mcp",
      ),
    ).toBe(true);
  });
  it("blocks mutations and credentials before network access", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    await expect(
      new LookbackMcpAdapter().callRead("token", {
        toolName: "create_project",
        arguments: {},
      }),
    ).rejects.toBeInstanceOf(LookbackMcpError);
    await expect(
      new LookbackMcpAdapter().callRead("token", {
        toolName: "list_projects",
        arguments: { password: "private" },
      }),
    ).rejects.toBeInstanceOf(LookbackMcpError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
