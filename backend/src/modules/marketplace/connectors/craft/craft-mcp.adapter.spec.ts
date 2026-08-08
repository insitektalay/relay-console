import {
  CRAFT_MCP_REGISTRATION_URL,
  CRAFT_MCP_URL,
  CraftMcpAdapter,
} from "./craft-mcp.adapter";

describe("CraftMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers a confidential PKCE client at Craft's fixed endpoint", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            client_id: "craft-client",
            client_secret: "secret",
          }),
          { status: 201 },
        ),
      );
    await expect(
      new CraftMcpAdapter().registerClient(
        "https://relay.example/api/v1/marketplace/oauth/craft/callback",
      ),
    ).resolves.toEqual({ clientId: "craft-client", clientSecret: "secret" });
    expect(fetchMock.mock.calls[0][0]).toBe(CRAFT_MCP_REGISTRATION_URL);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(
      expect.objectContaining({
        token_endpoint_auth_method: "client_secret_post",
        redirect_uris: [
          "https://relay.example/api/v1/marketplace/oauth/craft/callback",
        ],
      }),
    );
  });

  it("uses the official hosted MCP and validates live tool annotations", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { capabilities: { tools: {} } },
          }),
          { status: 200, headers: { "Mcp-Session-Id": "craft-session" } },
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
                  name: "search_documents",
                  inputSchema: { type: "object" },
                  annotations: { readOnlyHint: true },
                },
                {
                  name: "create_document",
                  inputSchema: { type: "object" },
                  annotations: { readOnlyHint: false },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    await expect(new CraftMcpAdapter().health("token")).resolves.toEqual({
      toolCount: 2,
      readToolCount: 1,
      manageToolCount: 1,
      liveToolsVerified: true,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(CRAFT_MCP_URL);
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ "Mcp-Session-Id": "craft-session" }),
      }),
    );
  });

  it("does not let a mutation run through the read wrapper", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { capabilities: { tools: {} } },
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
                  name: "create_document",
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
      new CraftMcpAdapter().callRead("token", {
        toolName: "create_document",
        arguments: { title: "No" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked", statusCode: 403 });
  });

  it("rejects credential-bearing tool arguments before network access", async () => {
    await expect(
      new CraftMcpAdapter().callManage("token", {
        toolName: "create_document",
        arguments: { apiKey: "not-allowed" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
