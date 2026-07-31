import {
  DRAW_IO_TOOLS,
  DrawIoMcpAdapter,
  DrawIoMcpError,
} from "./draw-io-mcp.adapter";

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
        tools: DRAW_IO_TOOLS.map((name) => ({ name, inputSchema: { type: "object" } })),
      },
    }),
    { status: 200 },
  );

describe("DrawIoMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the official hosted MCP and invokes one exact tool without credentials", async () => {
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
            result: { content: [{ type: "text", text: "shape results" }] },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new DrawIoMcpAdapter().call({
        toolName: "search_shapes",
        arguments: { query: "aws lambda", limit: 5 },
      }),
    ).resolves.toEqual({ content: [{ type: "text", text: "shape results" }] });
    expect(fetchMock.mock.calls.every((call) => String(call[0]) === "https://mcp.draw.io/mcp")).toBe(true);
    expect(fetchMock.mock.calls.some((call) => Boolean((call[1]?.headers as Record<string, string>)?.Authorization))).toBe(false);
  });

  it("blocks undocumented tools and credential-bearing arguments", async () => {
    const adapter = new DrawIoMcpAdapter();
    expect(() => adapter.call({ toolName: "unknown", arguments: {} })).toThrow(
      expect.objectContaining<Partial<DrawIoMcpError>>({ code: "policy_blocked" }),
    );
    expect(() =>
      adapter.call({ toolName: "create_diagram", arguments: { apiKey: "must-not-pass" } }),
    ).toThrow(expect.objectContaining<Partial<DrawIoMcpError>>({ code: "policy_blocked" }));
  });

  it("fails closed when the documented two-tool surface drifts", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: { tools: [{ name: "search_shapes", inputSchema: { type: "object" } }] },
          }),
          { status: 200 },
        ),
      );
    await expect(new DrawIoMcpAdapter().health()).rejects.toMatchObject<
      Partial<DrawIoMcpError>
    >({ code: "provider_validation_error" });
  });
});
