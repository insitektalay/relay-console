import {
  JiraServiceManagementApiAdapter,
  JiraServiceManagementApiError,
} from "./jira-service-management-api.adapter";
import {
  JIRA_SERVICE_MANAGEMENT_CONNECTOR_MANIFEST,
  JIRA_SERVICE_MANAGEMENT_REQUIRED_SCOPES,
} from "./jira-service-management.connector";

describe("JiraServiceManagementApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes complete Safe and Dangerous policies", () => {
    expect(JIRA_SERVICE_MANAGEMENT_REQUIRED_SCOPES).toContain(
      "read:servicedesk-request",
    );
    expect(JIRA_SERVICE_MANAGEMENT_REQUIRED_SCOPES).toContain(
      "write:servicedesk-request",
    );
    expect(
      JIRA_SERVICE_MANAGEMENT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["jsm.read", "jsm.manage"]);
    expect(
      JIRA_SERVICE_MANAGEMENT_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["jsm_manage"]);
    expect(
      JIRA_SERVICE_MANAGEMENT_CONNECTOR_MANIFEST.approvalProfiles[1]
        .approvalRequiredActions,
    ).toEqual([]);
  });

  it("pins health checks and reads to the selected site", async () => {
    jest.spyOn(global, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ values: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const adapter = new JiraServiceManagementApiAdapter();
    await adapter.health("access-token", "cloud-1");
    await adapter.read("access-token", "cloud-1", {
      path: "/rest/servicedeskapi/request",
      query: { limit: 500 },
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        hostname: "api.atlassian.com",
        pathname: "/ex/jira/cloud-1/rest/servicedeskapi/servicedesk",
      }),
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
    const url = (fetch as jest.Mock).mock.calls[1][0] as URL;
    expect(url.pathname).toBe("/ex/jira/cloud-1/rest/servicedeskapi/request");
    expect(url.searchParams.get("limit")).toBe("100");
  });

  it("supports documented service-management mutations", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ issueId: "10001" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await new JiraServiceManagementApiAdapter().manage("token", "cloud-1", {
      method: "POST",
      path: "/rest/servicedeskapi/request",
      json: {
        serviceDeskId: "1",
        requestTypeId: "2",
        requestFieldValues: { summary: "Printer unavailable" },
      },
    });
    const [url, request] = (fetch as jest.Mock).mock.calls[0];
    expect((url as URL).pathname).toBe(
      "/ex/jira/cloud-1/rest/servicedeskapi/request",
    );
    expect(request.method).toBe("POST");
  });

  it("blocks other origins, Jira platform routes, credentials, and oversized arrays", async () => {
    const adapter = new JiraServiceManagementApiAdapter();
    await expect(
      adapter.read("token", "cloud-1", {
        path: "https://example.com/rest/servicedeskapi/request",
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read("token", "cloud-1", { path: "/rest/api/3/issue" }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage("token", "cloud-1", {
        method: "POST",
        path: "/rest/servicedeskapi/request",
        json: { accessToken: "must-not-pass" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage("token", "cloud-1", {
        method: "POST",
        path: "/rest/servicedeskapi/request",
        json: { values: Array.from({ length: 101 }, () => "x") },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects invalid cloud IDs before making a request", async () => {
    await expect(
      new JiraServiceManagementApiAdapter().health("token", "../other-site"),
    ).rejects.toBeInstanceOf(JiraServiceManagementApiError);
  });
});
