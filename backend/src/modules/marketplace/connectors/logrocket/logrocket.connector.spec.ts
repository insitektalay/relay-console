import {
  LogRocketMcpAdapter,
  LogRocketMcpError,
} from "./logrocket-mcp.adapter";
import { LOGROCKET_CONNECTOR_MANIFEST } from "./logrocket.connector";

const credentials = {
  apiKey: "customer-project-key",
  organizationId: "relay-org",
  projectId: "web-app",
};

describe("LogRocket connector", () => {
  it("publishes one approval-gated issues-only action", () => {
    expect(
      LOGROCKET_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "LOGROCKET_API_KEY",
      "LOGROCKET_ORGANIZATION_ID",
      "LOGROCKET_PROJECT_ID",
    ]);
    expect(LOGROCKET_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      ["logrocket.findIssues"],
    );
    expect(
      LOGROCKET_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["logrocket_find_issues"]);
  });

  it("binds health to the exact project issues toolset", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        json(
          {
            jsonrpc: "2.0",
            id: 1,
            result: { capabilities: { tools: {} } },
          },
          { "mcp-session-id": "session-1" },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        json({
          jsonrpc: "2.0",
          id: 2,
          result: {
            tools: [{ name: "find_issues", inputSchema: { type: "object" } }],
          },
        }),
      );
    const result = await new LogRocketMcpAdapter(
      fetchMock as unknown as typeof fetch,
    ).health(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://mcp.logrocket.com/mcp/relay-org/web-app?toolsets=issues",
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer customer-project-key",
    );
    expect(result).toMatchObject({
      exactProjectBound: true,
      issuesToolsetOnly: true,
      toolName: "find_issues",
      sessionReplayReturned: false,
      writesEnabled: false,
    });
  });

  it("calls only dynamically discovered find_issues and bounds the result", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        json(
          { jsonrpc: "2.0", id: 1, result: { capabilities: { tools: {} } } },
          { "mcp-session-id": "session-2" },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        json({
          jsonrpc: "2.0",
          id: 2,
          result: {
            tools: [{ name: "find_issues", inputSchema: { type: "object" } }],
          },
        }),
      )
      .mockResolvedValueOnce(
        json({
          jsonrpc: "2.0",
          id: 3,
          result: {
            content: [{ type: "text", text: "Issue summary" }],
            accessToken: "never-return",
          },
        }),
      );
    const result = await new LogRocketMcpAdapter(
      fetchMock as unknown as typeof fetch,
    ).findIssues(credentials, { arguments: { query: "recent severe issues" } });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toMatchObject({
      method: "tools/call",
      params: {
        name: "find_issues",
        arguments: { query: "recent severe issues" },
      },
    });
    expect(result).toMatchObject({
      semanticReadContract: "logrocket-project-issues-v1",
      exactProjectBound: true,
      issuesToolsetOnly: true,
      sessionWatchingEnabled: false,
      metricsEnabled: false,
      galileoEnabled: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("never-return");
    expect(JSON.stringify(result)).toContain("[redacted]");
  });

  it("rejects unsafe project IDs and credential-bearing arguments before fetch", async () => {
    const fetchMock = jest.fn();
    const adapter = new LogRocketMcpAdapter(
      fetchMock as unknown as typeof fetch,
    );
    await expect(
      adapter.health({ ...credentials, projectId: "../other-project" }),
    ).rejects.toBeInstanceOf(LogRocketMcpError);
    await expect(
      adapter.findIssues(credentials, { arguments: { apiKey: "secret" } }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response("", { status: 429 }));
    await expect(
      new LogRocketMcpAdapter(fetchMock as unknown as typeof fetch).health(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function json(value: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}
