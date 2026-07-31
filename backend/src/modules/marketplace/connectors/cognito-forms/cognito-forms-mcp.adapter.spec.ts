import {
  COGNITO_FORMS_MCP_URL,
  COGNITO_FORMS_READ_TOOLS,
  COGNITO_FORMS_WRITE_TOOLS,
  CognitoFormsMcpAdapter,
  CognitoFormsMcpError,
} from "./cognito-forms-mcp.adapter";

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
        tools: [...COGNITO_FORMS_READ_TOOLS, ...COGNITO_FORMS_WRITE_TOOLS].map(
          (name) => ({ name, inputSchema: { type: "object" } }),
        ),
      },
    }),
    { status: 200 },
  );

describe("CognitoFormsMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins Cognito Forms' hosted MCP and invokes an exact documented read tool", async () => {
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
            result: { content: [{ type: "text", text: "entry-42" }] },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new CognitoFormsMcpAdapter().callRead("oauth-token", {
        toolName: "get_entry",
        arguments: { formId: "form-1", entryId: "42" },
      }),
    ).resolves.toEqual({ content: [{ type: "text", text: "entry-42" }] });
    expect(
      fetchMock.mock.calls.every(
        (call) => String(call[0]) === COGNITO_FORMS_MCP_URL,
      ),
    ).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual(
      expect.objectContaining({
        method: "tools/call",
        params: {
          name: "get_entry",
          arguments: { formId: "form-1", entryId: "42" },
        },
      }),
    );
  });

  it("blocks cross-policy calls and credential-bearing arguments", async () => {
    const adapter = new CognitoFormsMcpAdapter();
    await expect(
      adapter.callRead("oauth-token", {
        toolName: "delete_entry",
        arguments: {},
      }),
    ).rejects.toMatchObject<Partial<CognitoFormsMcpError>>({
      code: "policy_blocked",
    });
    await expect(
      adapter.callWrite("oauth-token", {
        toolName: "create_entry",
        arguments: { formId: "form-1", apiKey: "must-not-pass" },
      }),
    ).rejects.toMatchObject<Partial<CognitoFormsMcpError>>({
      code: "policy_blocked",
    });
  });

  it("fails closed when Cognito Forms' documented 9-tool surface drifts", async () => {
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
              tools: [{ name: "get_entry", inputSchema: { type: "object" } }],
            },
          }),
          { status: 200 },
        ),
      );
    await expect(
      new CognitoFormsMcpAdapter().health("oauth-token"),
    ).rejects.toMatchObject<Partial<CognitoFormsMcpError>>({
      code: "provider_validation_error",
    });
  });
});
