import {
  XMIND_READ_TOOLS,
  XMIND_WRITE_TOOLS,
  XMindMcpAdapter,
  XMindMcpError,
} from "./xmind-mcp.adapter";

const initialize = () =>
  new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { capabilities: { tools: {} } },
    }),
    { status: 200 },
  );
const list = () =>
  new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      result: {
        tools: [...XMIND_READ_TOOLS, ...XMIND_WRITE_TOOLS].map((name) => ({
          name,
          inputSchema: { type: "object" },
        })),
      },
    }),
    { status: 200 },
  );

describe("XMindMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins XMind's official hosted MCP and invokes an exact documented read tool", async () => {
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
            result: { content: [{ type: "text", text: "recent maps" }] },
          }),
          { status: 200 },
        ),
      );
    await expect(
      new XMindMcpAdapter().callRead("oauth-token", {
        toolName: "xmind_list_mindmaps",
        arguments: {},
      }),
    ).resolves.toEqual({ content: [{ type: "text", text: "recent maps" }] });
    expect(
      fetchMock.mock.calls.every(
        (call) => String(call[0]) === "https://app.xmind.com/api/mcp",
      ),
    ).toBe(true);
  });

  it("blocks cross-policy calls and credential-bearing arguments", async () => {
    const adapter = new XMindMcpAdapter();
    await expect(
      adapter.callRead("oauth-token", {
        toolName: "xmind_create_mindmap",
        arguments: {},
      }),
    ).rejects.toMatchObject<Partial<XMindMcpError>>({ code: "policy_blocked" });
    await expect(
      adapter.callWrite("oauth-token", {
        toolName: "xmind_edit_mindmap",
        arguments: { apiKey: "must-not-pass" },
      }),
    ).rejects.toMatchObject<Partial<XMindMcpError>>({ code: "policy_blocked" });
  });

  it("fails closed when XMind's documented four-tool surface drifts", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              tools: [
                {
                  name: "xmind_list_mindmaps",
                  inputSchema: { type: "object" },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    await expect(
      new XMindMcpAdapter().health("oauth-token"),
    ).rejects.toMatchObject<Partial<XMindMcpError>>({
      code: "provider_validation_error",
    });
  });
});
