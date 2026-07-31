import {
  FirstPromoterMcpAdapter,
  FirstPromoterMcpError,
} from "./firstpromoter-mcp.adapter";

describe("FirstPromoterMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins one zero-argument analytics tool after live schema verification", async () => {
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
                  name: "get_dashboard_stats",
                  inputSchema: { type: "object", properties: {} },
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
              content: [{ type: "text", text: "Revenue summary" }],
              payout_email: "private@example.com",
            },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new FirstPromoterMcpAdapter().read(
        "oauth-access-token",
        "dashboard-stats.get",
      ),
    ).resolves.toEqual({
      content: [{ type: "text", text: "Revenue summary" }],
      payout_email: "[redacted]",
    });
    const call = JSON.parse(String(fetchSpy.mock.calls[3]?.[1]?.body));
    expect(call).toEqual(
      expect.objectContaining({
        method: "tools/call",
        params: { name: "get_dashboard_stats", arguments: {} },
      }),
    );
    expect(fetchSpy.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-access-token",
          "Mcp-Session-Id": "session-1",
        }),
      }),
    );
  });

  it("fails closed for unknown operations and required-argument schema drift", async () => {
    const adapter = new FirstPromoterMcpAdapter();
    await expect(adapter.read("token", "create_campaign")).rejects.toThrow(
      FirstPromoterMcpError,
    );
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
                  name: "list_campaigns",
                  inputSchema: { type: "object", required: ["accountId"] },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    await expect(adapter.read("token", "campaigns.list")).rejects.toThrow(
      "schema changed",
    );
  });
});
