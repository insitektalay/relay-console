import {
  GRAIN_READ_TOOLS,
  GRAIN_WRITE_TOOLS,
  GrainMcpAdapter,
  GrainMcpError,
} from "./grain-mcp.adapter";

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
        tools: [...GRAIN_READ_TOOLS, ...GRAIN_WRITE_TOOLS].map((name) => ({
          name,
          inputSchema: { type: "object" },
        })),
      },
    }),
    { status: 200 },
  );

describe("GrainMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins Grain's official hosted MCP and invokes an exact documented read tool", async () => {
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
            result: { content: [{ type: "text", text: "meeting notes" }] },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new GrainMcpAdapter().callRead("oauth-token", {
        toolName: "fetch_meeting_notes",
        arguments: { meeting_id: "meeting-1" },
      }),
    ).resolves.toEqual({ content: [{ type: "text", text: "meeting notes" }] });
    expect(fetchMock.mock.calls.every((call) => String(call[0]) === "https://api.grain.com/_/mcp")).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual(
      expect.objectContaining({
        method: "tools/call",
        params: { name: "fetch_meeting_notes", arguments: { meeting_id: "meeting-1" } },
      }),
    );
  });

  it("blocks cross-policy calls and credential-bearing arguments", async () => {
    const adapter = new GrainMcpAdapter();
    await expect(
      adapter.callRead("oauth-token", { toolName: "create_clip", arguments: {} }),
    ).rejects.toMatchObject<Partial<GrainMcpError>>({ code: "policy_blocked" });
    await expect(
      adapter.callWrite("oauth-token", {
        toolName: "create_clip",
        arguments: { meeting_id: "meeting-1", apiKey: "must-not-pass" },
      }),
    ).rejects.toMatchObject<Partial<GrainMcpError>>({ code: "policy_blocked" });
  });

  it("fails closed when Grain's documented 22-tool surface drifts", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: { tools: [{ name: "myself", inputSchema: { type: "object" } }] },
          }),
          { status: 200 },
        ),
      );
    await expect(new GrainMcpAdapter().health("oauth-token")).rejects.toMatchObject<
      Partial<GrainMcpError>
    >({ code: "provider_validation_error" });
  });
});
