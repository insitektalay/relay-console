import {
  SUNSAMA_MANAGE_TOOLS,
  SUNSAMA_READ_TOOLS,
  SunsamaMcpAdapter,
  SunsamaMcpError,
} from "./sunsama-mcp.adapter";

describe("SunsamaMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the fixed hosted MCP and verifies the complete supported tool map", async () => {
    const tools = [...SUNSAMA_READ_TOOLS, ...SUNSAMA_MANAGE_TOOLS].map(
      (name) => ({
        name,
        inputSchema: { type: "object" },
        annotations: {
          readOnlyHint: (SUNSAMA_READ_TOOLS as readonly string[]).includes(name),
        },
      }),
    );
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { capabilities: { tools: {}, resources: {} } },
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            result: {
              resourceTemplates: [
                { uriTemplate: "sunsama://tasks/{date}" },
              ],
            },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new SunsamaMcpAdapter().health("access-token"),
    ).resolves.toEqual({
      toolCount: 7,
      documentedToolsVerified: true,
      readToolCount: 2,
      manageToolCount: 5,
      dailyTaskResourceTemplate: "sunsama://tasks/{date}",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.sunsama.com/mcp");
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
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { capabilities: { tools: {}, resources: {} } },
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
                  name: "timebox_a_task_to_calendar",
                  inputSchema: { type: "object" },
                  annotations: { readOnlyHint: false },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    await expect(
      new SunsamaMcpAdapter().callRead("token", {
        toolName: "timebox_a_task_to_calendar",
        arguments: { title: "Focus" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked", statusCode: 403 });
  });

  it("rejects credential-bearing arguments before opening a session", async () => {
    await expect(
      new SunsamaMcpAdapter().callManage("token", {
        toolName: "edit_task_notes",
        arguments: { apiKey: "not-allowed" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("reads only the bounded official daily-task resource", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { capabilities: { tools: {}, resources: {} } },
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
            result: { contents: [{ uri: "sunsama://tasks/2026-07-15" }] },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new SunsamaMcpAdapter().readTasksForDay("token", {
        date: "2026-07-15",
      }),
    ).resolves.toEqual({
      contents: [{ uri: "sunsama://tasks/2026-07-15" }],
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual(
      expect.objectContaining({
        method: "resources/read",
        params: { uri: "sunsama://tasks/2026-07-15" },
      }),
    );
  });

  it("maps OAuth rejection safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(new SunsamaMcpAdapter().health("expired")).rejects.toEqual(
      expect.objectContaining<Partial<SunsamaMcpError>>({
        code: "credential_missing",
        statusCode: 401,
      }),
    );
  });
});
