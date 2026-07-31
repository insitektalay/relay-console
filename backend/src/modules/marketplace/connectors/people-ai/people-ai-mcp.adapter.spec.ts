import { PeopleAiMcpAdapter, PeopleAiMcpError } from "./people-ai-mcp.adapter";

describe("PeopleAiMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins find_account after live single-string schema verification", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { capabilities: { tools: {} } },
          }),
          { status: 200, headers: { "mcp-session-id": "session-1" } },
        ),
      )
      .mockResolvedValueOnce(new Response("", { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              tools: [
                {
                  name: "find_account",
                  inputSchema: {
                    type: "object",
                    properties: { query: { type: "string" } },
                    required: ["query"],
                  },
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
            result: {
              content: [{ type: "text", text: "Acme account" }],
              contactEmail: "private@example.com",
            },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new PeopleAiMcpAdapter().read(
        { clientId: "client-id", clientSecret: "client-secret" },
        "accounts.search",
        "Acme",
      ),
    ).resolves.toEqual({
      content: [{ type: "text", text: "Acme account" }],
      contactEmail: "[redacted]",
    });
    const call = JSON.parse(String(fetchSpy.mock.calls[3]?.[1]?.body));
    expect(call).toEqual(
      expect.objectContaining({
        method: "tools/call",
        params: { name: "find_account", arguments: { query: "Acme" } },
      }),
    );
    expect(fetchSpy.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({
          "PAI-Client-Id": "client-id",
          "PAI-Client-Secret": "client-secret",
          "Mcp-Session-Id": "session-1",
        }),
      }),
    );
  });

  it("fails closed for unknown operations and schema drift", async () => {
    const adapter = new PeopleAiMcpAdapter();
    await expect(
      adapter.read(
        { clientId: "id", clientSecret: "secret" },
        "opportunity-status.get",
        "Acme",
      ),
    ).rejects.toThrow(PeopleAiMcpError);
    jest
      .spyOn(globalThis, "fetch")
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
      .mockResolvedValueOnce(new Response("", { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              tools: [
                {
                  name: "find_account",
                  inputSchema: {
                    type: "object",
                    properties: {
                      query: { type: "string" },
                      workspace: { type: "string" },
                    },
                    required: ["query", "workspace"],
                  },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    await expect(
      adapter.read(
        { clientId: "id", clientSecret: "secret" },
        "accounts.search",
        "Acme",
      ),
    ).rejects.toThrow("schema changed");
  });
});
