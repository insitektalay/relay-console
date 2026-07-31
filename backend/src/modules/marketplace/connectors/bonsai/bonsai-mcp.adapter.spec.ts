import {
  BONSAI_READ_TOOLS,
  BONSAI_WRITE_TOOLS,
  BonsaiMcpAdapter,
  type BonsaiMcpError,
} from "./bonsai-mcp.adapter";

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
        tools: [...BONSAI_READ_TOOLS, ...BONSAI_WRITE_TOOLS].map((name) => ({
          name,
          inputSchema: { type: "object" },
        })),
      },
    }),
    { status: 200 },
  );

describe("BonsaiMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the official 25-tool MCP surface and invokes an exact read", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(list())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            result: {
              content: [{ type: "text", text: "tasks" }],
              token: "never-return",
            },
          }),
          { status: 200 },
        ),
      );
    await expect(
      new BonsaiMcpAdapter().callRead("oauth-token", {
        toolName: "list_tasks",
        arguments: { status: "open" },
      }),
    ).resolves.toEqual({
      content: [{ type: "text", text: "tasks" }],
      token: "[redacted]",
    });
    expect(
      fetchMock.mock.calls.every(
        (call) => String(call[0]) === "https://mcp.hellobonsai.com/mcp",
      ),
    ).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual(
      expect.objectContaining({
        method: "tools/call",
        params: { name: "list_tasks", arguments: { status: "open" } },
      }),
    );
  });

  it("blocks cross-policy calls and credential-bearing arguments", async () => {
    const adapter = new BonsaiMcpAdapter();
    await expect(
      adapter.callRead("oauth-token", {
        toolName: "create_invoice",
        arguments: {},
      }),
    ).rejects.toMatchObject<Partial<BonsaiMcpError>>({
      code: "policy_blocked",
    });
    await expect(
      adapter.callWrite("oauth-token", {
        toolName: "create_task",
        arguments: { access_token: "never-forward" },
      }),
    ).rejects.toMatchObject<Partial<BonsaiMcpError>>({
      code: "policy_blocked",
    });
  });

  it("fails closed when the documented tool set drifts", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              tools: [{ name: "list_tasks", inputSchema: { type: "object" } }],
            },
          }),
          { status: 200 },
        ),
      );
    await expect(
      new BonsaiMcpAdapter().health("oauth-token"),
    ).rejects.toMatchObject<Partial<BonsaiMcpError>>({
      code: "provider_validation_error",
    });
  });
});
