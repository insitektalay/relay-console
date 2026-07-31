import {
  AKIFLOW_MANAGE_TOOLS,
  AKIFLOW_READ_TOOLS,
  AkiflowMcpAdapter,
  AkiflowMcpError,
} from "./akiflow-mcp.adapter";

describe("AkiflowMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the fixed hosted MCP and verifies the complete supported tool map", async () => {
    const tools = [...AKIFLOW_READ_TOOLS, ...AKIFLOW_MANAGE_TOOLS].map(
      (name) => ({ name, inputSchema: { type: "object" } }),
    );
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { capabilities: { tools: {} } },
          }),
          { status: 200, headers: { "Mcp-Session-Id": "fixture" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools } }),
          { status: 200 },
        ),
      );

    await expect(
      new AkiflowMcpAdapter().health("access-token"),
    ).resolves.toEqual({
      toolCount: 22,
      documentedToolsVerified: true,
      readToolCount: 10,
      manageToolCount: 12,
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://mcp.akiflow.com/mcp");
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          Accept: "application/json, text/event-stream",
        }),
      }),
    );
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ "Mcp-Session-Id": "fixture" }),
      }),
    );
  });

  it("routes mutations away from the read action", async () => {
    await expect(
      new AkiflowMcpAdapter().callRead("token", {
        toolName: "add-event",
        arguments: { title: "Focus" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked", statusCode: 403 });
  });

  it("rejects credential-bearing arguments before opening a session", async () => {
    await expect(
      new AkiflowMcpAdapter().callManage("token", {
        toolName: "edit-task",
        arguments: { apiKey: "not-allowed" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps OAuth rejection safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(new AkiflowMcpAdapter().health("expired")).rejects.toEqual(
      expect.objectContaining<Partial<AkiflowMcpError>>({
        code: "credential_missing",
        statusCode: 401,
      }),
    );
  });
});
