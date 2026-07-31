import { JiraApiAdapter, JiraApiError } from "./jira-api.adapter";
import {
  JIRA_CONNECTOR_MANIFEST,
  JIRA_REQUIRED_SCOPES,
} from "./jira.connector";

describe("JiraApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one Jira connection with complete Safe and Dangerous policy", () => {
    expect(JIRA_REQUIRED_SCOPES).toContain("read:jira-work");
    expect(JIRA_REQUIRED_SCOPES).toContain("delete:sprint:jira-software");
    expect(JIRA_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "jira.read",
      "jira.manage",
    ]);
    expect(
      JIRA_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["jira_manage"]);
    expect(
      JIRA_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions,
    ).toEqual([]);
  });

  it("pins reads and health checks to the selected Atlassian cloud ID", async () => {
    jest.spyOn(global, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ accountId: "account-1", issues: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const adapter = new JiraApiAdapter();
    await adapter.health("access-token", "cloud-1");
    await adapter.read("access-token", "cloud-1", {
      path: "/rest/api/3/search",
      query: { jql: "project = RELAY", maxResults: 500 },
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        hostname: "api.atlassian.com",
        pathname: "/ex/jira/cloud-1/rest/api/3/myself",
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
    expect(url.pathname).toBe("/ex/jira/cloud-1/rest/api/3/search");
    expect(url.searchParams.get("maxResults")).toBe("100");
  });

  it("supports documented Jira Software mutations", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: 42 }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await new JiraApiAdapter().manage("token", "cloud-1", {
      method: "POST",
      path: "/rest/agile/1.0/sprint",
      json: { name: "Release sprint", originBoardId: 7 },
    });
    const [url, request] = (fetch as jest.Mock).mock.calls[0];
    expect((url as URL).pathname).toBe(
      "/ex/jira/cloud-1/rest/agile/1.0/sprint",
    );
    expect(request.method).toBe("POST");
  });

  it("uses the Jira platform API for Product Discovery projects and ideas", async () => {
    jest.spyOn(global, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ values: [], key: "DISC-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const adapter = new JiraApiAdapter();
    await adapter.read("token", "cloud-1", {
      path: "/rest/api/3/project/search",
      query: { typeKey: "product_discovery" },
    });
    await adapter.manage("token", "cloud-1", {
      method: "POST",
      path: "/rest/api/3/issue",
      json: {
        fields: {
          project: { key: "DISC" },
          issuetype: { id: "10001" },
          summary: "Customer onboarding idea",
        },
      },
    });
    const readUrl = (fetch as jest.Mock).mock.calls[0][0] as URL;
    const manageUrl = (fetch as jest.Mock).mock.calls[1][0] as URL;
    expect(readUrl.pathname).toBe("/ex/jira/cloud-1/rest/api/3/project/search");
    expect(readUrl.searchParams.get("typeKey")).toBe("product_discovery");
    expect(manageUrl.pathname).toBe("/ex/jira/cloud-1/rest/api/3/issue");
  });

  it("blocks other origins, service-management routes, credentials, and oversized arrays", async () => {
    const adapter = new JiraApiAdapter();
    await expect(
      adapter.read("token", "cloud-1", {
        path: "https://example.com/rest/api/3/issue",
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read("token", "cloud-1", {
        path: "/rest/servicedeskapi/request",
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage("token", "cloud-1", {
        method: "POST",
        path: "/rest/api/3/issue",
        json: { accessToken: "must-not-pass" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage("token", "cloud-1", {
        method: "POST",
        path: "/rest/api/3/issue",
        json: { values: Array.from({ length: 101 }, () => "x") },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects invalid cloud IDs before making a request", async () => {
    await expect(
      new JiraApiAdapter().health("token", "../another-site"),
    ).rejects.toBeInstanceOf(JiraApiError);
  });
});
