import {
  ADOBE_ANALYTICS_READ_TOOLS,
  AdobeAnalyticsMcpAdapter,
  AdobeAnalyticsMcpError,
} from "./adobe-analytics-mcp.adapter";

describe("AdobeAnalyticsMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the Adobe-hosted MCP and invokes an allowlisted reporting tool", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    fetchSpy
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
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              tools: ADOBE_ANALYTICS_READ_TOOLS.map((name) => ({
                name,
                inputSchema: { type: "object", properties: {} },
              })),
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
            result: { content: [{ type: "text", text: "ok" }] },
          }),
          { status: 200 },
        ),
      );
    await expect(
      new AdobeAnalyticsMcpAdapter().callRead("access-token", {
        toolName: "findCompanies",
        arguments: {},
      }),
    ).resolves.toEqual({ content: [{ type: "text", text: "ok" }] });
    expect(
      fetchSpy.mock.calls.every(
        ([url]) => url === "https://aa-mcp.adobe.io/mcp",
      ),
    ).toBe(true);
  });

  it("blocks mutation tools and reports above 100 rows", async () => {
    await expect(
      new AdobeAnalyticsMcpAdapter().callRead("access-token", {
        toolName: "upsertSegment",
        arguments: {},
      }),
    ).rejects.toBeInstanceOf(AdobeAnalyticsMcpError);
    await expect(
      new AdobeAnalyticsMcpAdapter().callRead("access-token", {
        toolName: "runReport",
        arguments: { limit: 101 },
      }),
    ).rejects.toBeInstanceOf(AdobeAnalyticsMcpError);
  });
});
