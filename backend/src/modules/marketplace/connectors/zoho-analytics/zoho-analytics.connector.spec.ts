import {
  ZohoAnalyticsApiAdapter,
  ZohoAnalyticsApiError,
  type ZohoAnalyticsCredentials,
} from "./zoho-analytics-api.adapter";
import { ZOHO_ANALYTICS_CONNECTOR_MANIFEST } from "./zoho-analytics.connector";

const credentials: ZohoAnalyticsCredentials = {
  accessToken: "access-token",
  apiOrigin: "https://analyticsapi.zoho.eu",
  accountsOrigin: "https://accounts.zoho.eu",
  userId: "1000000000001",
};
describe("Zoho Analytics connector", () => {
  it("publishes only two approval-gated metadata reads", () => {
    expect(
      ZOHO_ANALYTICS_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes,
    ).toEqual(["AaaServer.profile.Read", "ZohoAnalytics.metadata.read"]);
    expect(
      ZOHO_ANALYTICS_CONNECTOR_MANIFEST.tools.map((tool) => tool.functionName),
    ).toEqual(["zoho_analytics_workspace_list", "zoho_analytics_view_list"]);
    expect(
      ZOHO_ANALYTICS_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });
  it("projects workspace metadata without descriptions or creator identities", async () => {
    const adapter = new ZohoAnalyticsApiAdapter(
      async () =>
        new Response(
          JSON.stringify({
            status: "success",
            data: {
              ownedWorkspaces: [
                {
                  workspaceId: "1001",
                  workspaceName: "Sales",
                  workspaceDesc: "private",
                  orgId: "2001",
                  createdBy: "private@example.com",
                  isDefault: true,
                },
              ],
              sharedWorkspaces: [],
            },
          }),
          { status: 200 },
        ),
    );
    const result = await adapter.listWorkspaces(credentials, { limit: 1 });
    expect(result).toEqual({
      workspaces: [
        {
          workspaceId: "1001",
          name: "Sales",
          organizationId: "2001",
          ownership: "owned",
          isDefault: true,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("lists bounded views with exact organization binding", async () => {
    const requester = jest.fn(async (_url: string | URL, init: RequestInit) => {
      expect((init.headers as Record<string, string>)["ZANALYTICS-ORGID"]).toBe(
        "2001",
      );
      return new Response(
        JSON.stringify({
          status: "success",
          data: {
            views: [
              {
                viewId: "3001",
                viewName: "Revenue",
                viewType: "Chart",
                viewDesc: "private",
                createdBy: "private@example.com",
              },
            ],
          },
        }),
        { status: 200 },
      );
    });
    await expect(
      new ZohoAnalyticsApiAdapter(requester).listViews(credentials, {
        organizationId: "2001",
        workspaceId: "1001",
        limit: 1,
      }),
    ).resolves.toEqual({
      organizationId: "2001",
      workspaceId: "1001",
      views: [{ viewId: "3001", name: "Revenue", type: "Chart" }],
    });
  });
  it("binds current user and checks metadata scope", async () => {
    const requester = jest.fn(async (url: string | URL) =>
      String(url).includes("user/info")
        ? new Response(JSON.stringify({ ZUID: "1000000000001" }), {
            status: 200,
          })
        : new Response(
            JSON.stringify({
              status: "success",
              data: { ownedWorkspaces: [], sharedWorkspaces: [] },
            }),
            { status: 200 },
          ),
    );
    await expect(
      new ZohoAnalyticsApiAdapter(requester).health(credentials),
    ).resolves.toMatchObject({ userId: "1000000000001" });
  });
  it("rejects unsafe identifiers, regions, and oversized responses", async () => {
    const adapter = new ZohoAnalyticsApiAdapter(
      async () =>
        new Response("{}", {
          status: 200,
          headers: { "content-length": "1000001" },
        }),
    );
    await expect(
      adapter.listViews(credentials, {
        organizationId: "../users",
        workspaceId: "1001",
      }),
    ).rejects.toBeInstanceOf(ZohoAnalyticsApiError);
    await expect(
      adapter.listWorkspaces(
        { ...credentials, apiOrigin: "https://attacker.example" },
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.listWorkspaces(credentials, {})).rejects.toMatchObject(
      { code: "provider_validation_error" },
    );
  });
});
