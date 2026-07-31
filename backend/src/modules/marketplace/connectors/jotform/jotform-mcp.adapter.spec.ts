import {
  JOTFORM_MCP_READ_TOOLS,
  JOTFORM_MCP_URL,
  JOTFORM_MCP_WRITE_TOOLS,
  JotformMcpAdapter,
  JotformMcpError,
} from "./jotform-mcp.adapter";

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
        tools: [...JOTFORM_MCP_READ_TOOLS, ...JOTFORM_MCP_WRITE_TOOLS].map(
          (name) => ({ name, inputSchema: { type: "object" } }),
        ),
      },
    }),
    { status: 200 },
  );

describe("JotformMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins Jotform's hosted MCP and invokes an exact documented read tool", async () => {
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
            result: { content: [{ type: "text", text: "form-42" }] },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new JotformMcpAdapter().callRead("oauth-token", {
        toolName: "form_list",
        arguments: {},
      }),
    ).resolves.toEqual({ content: [{ type: "text", text: "form-42" }] });
    expect(
      fetchMock.mock.calls.every((call) => String(call[0]) === JOTFORM_MCP_URL),
    ).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual(
      expect.objectContaining({
        method: "tools/call",
        params: { name: "form_list", arguments: {} },
      }),
    );
  });

  it("registers a fresh public PKCE client for each authorization attempt", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ client_id: "relay-jotform-client-1" }), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ client_id: "relay-jotform-client-2" }), {
          status: 201,
        }),
      );
    const adapter = new JotformMcpAdapter();
    const redirectUri =
      "https://relay.example/api/v1/marketplace/oauth/jotform/callback";

    await expect(adapter.registerPublicClient(redirectUri)).resolves.toEqual({
      clientId: "relay-jotform-client-1",
    });
    await expect(adapter.registerPublicClient(redirectUri)).resolves.toEqual({
      clientId: "relay-jotform-client-2",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(
      expect.objectContaining({
        token_endpoint_auth_method: "none",
        scope: "readOnly full",
        redirect_uris: [redirectUri],
      }),
    );
  });

  it("deduplicates only concurrent public client registrations", async () => {
    let completeRegistration: ((response: Response) => void) | undefined;
    const fetchMock = jest.spyOn(global, "fetch").mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          completeRegistration = resolve;
        }),
    );
    const adapter = new JotformMcpAdapter();
    const redirectUri =
      "https://relay.example/api/v1/marketplace/oauth/jotform/callback";

    const first = adapter.registerPublicClient(redirectUri);
    const second = adapter.registerPublicClient(redirectUri);
    completeRegistration?.(
      new Response(JSON.stringify({ client_id: "shared-client" }), {
        status: 201,
      }),
    );

    await expect(Promise.all([first, second])).resolves.toEqual([
      { clientId: "shared-client" },
      { clientId: "shared-client" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows a retry after public client registration fails", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("provider timeout"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ client_id: "retry-client" }), {
          status: 201,
        }),
      );
    const adapter = new JotformMcpAdapter();
    const redirectUri =
      "https://relay.example/api/v1/marketplace/oauth/jotform/callback";

    await expect(
      adapter.registerPublicClient(redirectUri),
    ).rejects.toMatchObject<Partial<JotformMcpError>>({
      code: "provider_unavailable",
      message:
        "Jotform took too long to prepare secure sign-in. Please try again.",
    });
    await expect(adapter.registerPublicClient(redirectUri)).resolves.toEqual({
      clientId: "retry-client",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks cross-policy calls and credential-bearing arguments", async () => {
    const adapter = new JotformMcpAdapter();
    await expect(
      adapter.callRead("oauth-token", {
        toolName: "create_form",
        arguments: {},
      }),
    ).rejects.toMatchObject<Partial<JotformMcpError>>({
      code: "policy_blocked",
    });
    await expect(
      adapter.callWrite("oauth-token", {
        toolName: "create_form",
        arguments: { apiKey: "must-not-pass" },
      }),
    ).rejects.toMatchObject<Partial<JotformMcpError>>({
      code: "policy_blocked",
    });
  });

  it("accepts the documented read tools for a read-only grant", async () => {
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
                "search",
                "get_submissions",
                "fetch",
                "create_form",
                "edit_form",
                "assign_form",
                "analyze_submissions",
              ].map((name) => ({
                name,
                inputSchema: { type: "object" },
              })),
            },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new JotformMcpAdapter().health("oauth-token", "readOnly"),
    ).resolves.toEqual({
      toolCount: 7,
      documentedToolsVerified: true,
      readToolCount: JOTFORM_MCP_READ_TOOLS.length,
      writeToolCount: 0,
    });
  });

  it("accepts Jotform's live full-scope tool surface", async () => {
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
                "search",
                "get_submissions",
                "fetch",
                "create_form",
                "edit_form",
                "assign_form",
                "analyze_submissions",
              ].map((name) => ({
                name,
                inputSchema: { type: "object" },
              })),
            },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new JotformMcpAdapter().health("oauth-token", "full"),
    ).resolves.toEqual({
      toolCount: 7,
      documentedToolsVerified: true,
      readToolCount: JOTFORM_MCP_READ_TOOLS.length,
      writeToolCount: 2,
    });
  });

  it("accepts and invokes Jotform's live search form-discovery tool", async () => {
    const fetchMock = jest
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
                { name: "search", inputSchema: { type: "object" } },
                {
                  name: "get_submissions",
                  inputSchema: { type: "object" },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            result: { content: [{ type: "text", text: "form-42" }] },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new JotformMcpAdapter().callRead("oauth-token", {
        toolName: "form_list",
        arguments: { query: "active forms" },
      }),
    ).resolves.toEqual({ content: [{ type: "text", text: "form-42" }] });
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual(
      expect.objectContaining({
        method: "tools/call",
        params: {
          name: "search",
          arguments: { query: "active forms" },
        },
      }),
    );
  });

  it("fails closed when Jotform's documented five-tool surface drifts", async () => {
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
              tools: [{ name: "form_list", inputSchema: { type: "object" } }],
            },
          }),
          { status: 200 },
        ),
      );
    await expect(
      new JotformMcpAdapter().health("oauth-token"),
    ).rejects.toMatchObject<Partial<JotformMcpError>>({
      code: "provider_validation_error",
    });
  });
});
