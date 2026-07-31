import {
  WHIMSICAL_READ_TOOLS,
  WHIMSICAL_WRITE_TOOLS,
  WhimsicalMcpAdapter,
  WhimsicalMcpError,
} from "./whimsical-mcp.adapter";

const initialize = () =>
  new Response(
    JSON.stringify({ jsonrpc: "2.0", id: 1, result: { capabilities: { tools: {} } } }),
    { status: 200 },
  );
const list = () =>
  new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      result: {
        tools: [...WHIMSICAL_READ_TOOLS, ...WHIMSICAL_WRITE_TOOLS].map((name) => ({
          name,
          inputSchema: { type: "object" },
        })),
      },
    }),
    { status: 200 },
  );

describe("WhimsicalMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins Whimsical's hosted MCP and invokes an exact documented read tool", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(list())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            result: { content: [{ type: "text", text: "architecture board" }] },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new WhimsicalMcpAdapter().callRead("oauth-token", {
        toolName: "fetch",
        arguments: { id: "file-1" },
      }),
    ).resolves.toEqual({ content: [{ type: "text", text: "architecture board" }] });
    expect(
      fetchMock.mock.calls.every(
        (call) => String(call[0]) === "https://mcp.whimsical.com/mcp",
      ),
    ).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual(
      expect.objectContaining({
        method: "tools/call",
        params: { name: "fetch", arguments: { id: "file-1" } },
      }),
    );
  });

  it("blocks cross-policy calls and credential-bearing arguments", async () => {
    const adapter = new WhimsicalMcpAdapter();
    await expect(
      adapter.callRead("oauth-token", { toolName: "create", arguments: {} }),
    ).rejects.toMatchObject<Partial<WhimsicalMcpError>>({ code: "policy_blocked" });
    await expect(
      adapter.callWrite("oauth-token", {
        toolName: "create",
        arguments: { type: "flowchart", apiKey: "must-not-pass" },
      }),
    ).rejects.toMatchObject<Partial<WhimsicalMcpError>>({ code: "policy_blocked" });
  });

  it("fails closed when Whimsical's documented 11-tool surface drifts", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: { tools: [{ name: "search", inputSchema: { type: "object" } }] },
          }),
          { status: 200 },
        ),
      );
    await expect(new WhimsicalMcpAdapter().health("oauth-token")).rejects.toMatchObject<
      Partial<WhimsicalMcpError>
    >({ code: "provider_validation_error" });
  });
});
