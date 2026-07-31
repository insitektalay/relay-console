import {
  OntraportMcpAdapter,
  OntraportMcpError,
  ONTRAPORT_MANAGE_TOOLS,
  ONTRAPORT_READ_TOOLS,
} from "./ontraport-mcp.adapter";

const credentials = { appId: "2_fixture", apiKey: "fixture-secret" };
const rpc = (id: number, result: Record<string, unknown>) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("OntraportMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins distinct documented read and manage tool surfaces", () => {
    const all = [...ONTRAPORT_READ_TOOLS, ...ONTRAPORT_MANAGE_TOOLS];
    expect(ONTRAPORT_READ_TOOLS).toContain("get_objects");
    expect(ONTRAPORT_MANAGE_TOOLS).toContain("process_transaction");
    expect(new Set(all).size).toBe(all.length);
  });

  it("uses only the fixed hosted MCP and injects credentials only as provider headers", async () => {
    const tools = [
      "list_allowed_object_types",
      "get_objects",
      "get_account_info",
    ].map((name) => ({ name, inputSchema: { type: "object" } }));
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(rpc(1, { capabilities: { tools: {} } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(rpc(2, { tools }))
      .mockResolvedValueOnce(rpc(3, { tools }))
      .mockResolvedValueOnce(
        rpc(4, {
          content: [{ type: "text", text: "bounded account identity" }],
        }),
      );

    await expect(
      new OntraportMcpAdapter().health(credentials),
    ).resolves.toEqual({
      toolCount: 3,
      documentedCoreVerified: true,
      identityVerified: true,
    });
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).toBe("https://mcp.ontraport.com");
      expect(init).toEqual(
        expect.objectContaining({
          method: "POST",
          redirect: "error",
          headers: expect.objectContaining({
            "Api-Appid": credentials.appId,
            "Api-Key": credentials.apiKey,
          }),
        }),
      );
      expect(String(init?.body)).not.toContain(credentials.apiKey);
      expect(String(init?.body)).not.toContain(credentials.appId);
    }
  });

  it("keeps mutations out of reads and credentials out of arguments", async () => {
    const adapter = new OntraportMcpAdapter();
    await expect(
      adapter.callRead(credentials, {
        toolName: "delete_objects",
        arguments: {},
      }),
    ).rejects.toMatchObject<Partial<OntraportMcpError>>({
      code: "policy_blocked",
    });
    await expect(
      adapter.callManage(credentials, {
        toolName: "update_object",
        arguments: { apiKey: "must-not-forward" },
      }),
    ).rejects.toMatchObject<Partial<OntraportMcpError>>({
      code: "policy_blocked",
    });
  });

  it("verifies the live schema before invoking an allowlisted tool", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(rpc(1, { capabilities: { tools: {} } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        rpc(2, {
          tools: [{ name: "get_objects", inputSchema: { type: "object" } }],
        }),
      )
      .mockResolvedValueOnce(
        rpc(3, { content: [{ type: "text", text: "one bounded result" }] }),
      );

    await expect(
      new OntraportMcpAdapter().callRead(credentials, {
        toolName: "get_objects",
        arguments: { object_type_id: 0, ids: ["1"] },
      }),
    ).resolves.toEqual({
      content: [{ type: "text", text: "one bounded result" }],
    });
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toMatchObject({
      method: "tools/call",
      params: { name: "get_objects" },
    });
  });

  it("maps credential rejection to a safe error", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(new OntraportMcpAdapter().health(credentials)).rejects.toEqual(
      expect.objectContaining<Partial<OntraportMcpError>>({
        code: "credential_missing",
        statusCode: 401,
      }),
    );
  });
});
