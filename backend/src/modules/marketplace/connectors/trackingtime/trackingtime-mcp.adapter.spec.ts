import {
  TrackingTimeMcpAdapter,
  TrackingTimeMcpError,
  TRACKINGTIME_DOCUMENTED_TOOL_COUNT,
  TRACKINGTIME_MANAGE_TOOLS,
  TRACKINGTIME_MCP_SOURCE_SHA256,
  TRACKINGTIME_READ_TOOLS,
} from "./trackingtime-mcp.adapter";

const rpc = (id: number, result: Record<string, unknown>) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("TrackingTimeMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the complete documented 26-tool surface", () => {
    expect(TRACKINGTIME_MCP_SOURCE_SHA256).toHaveLength(64);
    expect([
      ...TRACKINGTIME_READ_TOOLS,
      ...TRACKINGTIME_MANAGE_TOOLS,
    ]).toHaveLength(TRACKINGTIME_DOCUMENTED_TOOL_COUNT);
    expect(
      new Set([...TRACKINGTIME_READ_TOOLS, ...TRACKINGTIME_MANAGE_TOOLS]).size,
    ).toBe(TRACKINGTIME_DOCUMENTED_TOOL_COUNT);
  });

  it("uses the fixed hosted MCP endpoint and injects the App Password only as X-API-Key", async () => {
    const tools = [
      ...TRACKINGTIME_READ_TOOLS,
      ...TRACKINGTIME_MANAGE_TOOLS,
    ].map((name) => ({ name, inputSchema: { type: "object" } }));
    const fetchMock = jest.spyOn(global, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        rpc(1, {
          capabilities: { tools: {} },
          serverInfo: { name: "trackingtime-v4-mcp", version: "2.0.0" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(rpc(2, { tools }))
      .mockResolvedValueOnce(rpc(3, { tools }))
      .mockResolvedValueOnce(
        rpc(4, { content: [{ type: "text", text: "me" }] }),
      );

    await expect(
      new TrackingTimeMcpAdapter().health("app-password"),
    ).resolves.toEqual({
      toolCount: 26,
      documentedToolsVerified: true,
      identityVerified: true,
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://mcp.trackingtime.co/mcp");
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-API-Key": "app-password",
          Accept: "application/json, text/event-stream",
        }),
      }),
    );
    expect(
      fetchMock.mock.calls.map((call) => String(call[1]?.body)),
    ).not.toEqual(
      expect.arrayContaining([expect.stringContaining("app-password")]),
    );
  });

  it("keeps mutations out of the read action and credentials out of arguments", async () => {
    const adapter = new TrackingTimeMcpAdapter();
    await expect(
      adapter.callRead("secret", { toolName: "create_task", arguments: {} }),
    ).rejects.toMatchObject({ code: "policy_blocked", statusCode: 403 });
    await expect(
      adapter.callManage("secret", {
        toolName: "create_task",
        arguments: { app_password: "not-allowed" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked", statusCode: 403 });
  });

  it("maps App Password rejection safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      new TrackingTimeMcpAdapter().health("expired"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<TrackingTimeMcpError>>({
        code: "credential_missing",
        statusCode: 401,
      }),
    );
  });
});
