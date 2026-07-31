import { AnyDoMcpAdapter, AnyDoMcpError } from "./any-do-mcp.adapter";

describe("AnyDoMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses Any.do's fixed SSE endpoint and live-discovered object schemas", async () => {
    const sse = [
      "event: endpoint\ndata: /messages/?session_id=fixture\n\n",
      'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"capabilities":{"tools":{}}}}\n\n',
      'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"list_tasks","inputSchema":{"type":"object"}},{"name":"create_task","inputSchema":{"type":"object"}}]}}\n\n',
    ].join("");
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(sse, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      )
      .mockResolvedValue(new Response(null, { status: 202 }));

    await expect(new AnyDoMcpAdapter().health("access-token")).resolves.toEqual(
      {
        toolCount: 2,
        toolsVerified: true,
      },
    );
    expect(fetchMock.mock.calls[0][0]).toBe("https://mcp.any.do/sse");
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          Accept: "text/event-stream",
        }),
      }),
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://mcp.any.do/messages/?session_id=fixture",
    );
  });

  it("routes likely mutations away from the unapproved read action", async () => {
    await expect(
      new AnyDoMcpAdapter().callRead("token", {
        toolName: "create_task",
        arguments: { title: "Ship" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked", statusCode: 403 });
  });

  it("rejects credential-bearing arguments before opening a provider session", async () => {
    await expect(
      new AnyDoMcpAdapter().callWrite("token", {
        toolName: "update_task",
        arguments: { accessToken: "not-allowed" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps OAuth rejection safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(new AnyDoMcpAdapter().health("expired")).rejects.toEqual(
      expect.objectContaining<Partial<AnyDoMcpError>>({
        code: "credential_missing",
        statusCode: 401,
      }),
    );
  });
});
