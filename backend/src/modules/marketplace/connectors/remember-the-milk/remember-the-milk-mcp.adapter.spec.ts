import {
  REMEMBER_THE_MILK_MANAGE_TOOLS,
  REMEMBER_THE_MILK_READ_TOOLS,
  RememberTheMilkMcpAdapter,
  RememberTheMilkMcpError,
} from "./remember-the-milk-mcp.adapter";

describe("RememberTheMilkMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the fixed hosted MCP and verifies every documented tool", async () => {
    const tools = [
      ...REMEMBER_THE_MILK_READ_TOOLS,
      ...REMEMBER_THE_MILK_MANAGE_TOOLS,
    ].map((name) => ({ name, inputSchema: { type: "object" } }));
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
      new RememberTheMilkMcpAdapter().health("access-token"),
    ).resolves.toEqual({
      toolCount: 58,
      documentedToolsVerified: true,
      readToolCount: 16,
      manageToolCount: 42,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.rememberthemilk.com/mcp",
    );
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

  it("routes management tools away from the read action", async () => {
    await expect(
      new RememberTheMilkMcpAdapter().callRead("token", {
        toolName: "rtm_add_task",
        arguments: { name: "Ship" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked", statusCode: 403 });
  });

  it("rejects credential-bearing arguments before opening a session", async () => {
    await expect(
      new RememberTheMilkMcpAdapter().callManage("token", {
        toolName: "rtm_update_task",
        arguments: { apiKey: "not-allowed" },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("maps OAuth rejection safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      new RememberTheMilkMcpAdapter().health("expired"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<RememberTheMilkMcpError>>({
        code: "credential_missing",
        statusCode: 401,
      }),
    );
  });
});
