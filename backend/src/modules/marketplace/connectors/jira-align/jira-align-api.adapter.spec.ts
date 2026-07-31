import {
  JiraAlignApiAdapter,
  JiraAlignApiError,
} from "./jira-align-api.adapter";
import { JIRA_ALIGN_CONNECTOR_MANIFEST } from "./jira-align.connector";

const credentials = {
  siteUrl: "https://customer.jiraalign.com",
  email: "agent@example.com",
  apiToken: "scoped-token",
};

describe("JiraAlignApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes read and approval-gated management tools", () => {
    expect(
      JIRA_ALIGN_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["jira-align.read", "jira-align.manage"]);
    expect(
      JIRA_ALIGN_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["jira_align_manage"]);
  });

  it("pins API 2.0 reads to the validated tenant and uses Atlassian Basic auth", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: 7, title: "Roadmap" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await new JiraAlignApiAdapter().request(credentials, {
      method: "GET",
      path: "/Epics",
      query: { $top: 1 },
    });
    const [requestUrl, request] = (fetch as jest.Mock).mock.calls[0];
    expect(String(requestUrl)).toBe(
      "https://customer.jiraalign.com/rest/align/api/2/Epics?%24top=1",
    );
    expect(request).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("agent@example.com:scoped-token").toString("base64")}`,
        }),
        redirect: "error",
      }),
    );
  });

  it("allows documented creates and updates but blocks unsupported mutations", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 8 }), { status: 200 }),
      );
    await new JiraAlignApiAdapter().request(credentials, {
      method: "PATCH",
      path: "/Epics/8",
      json: { title: "Updated" },
    });
    await expect(
      new JiraAlignApiAdapter().request(credentials, {
        method: "PATCH",
        path: "/Portfolios/8",
        json: { title: "Blocked" },
      }),
    ).rejects.toBeInstanceOf(JiraAlignApiError);
  });

  it("rejects tenant escapes, undocumented routes, and credential-bearing payloads", async () => {
    const adapter = new JiraAlignApiAdapter();
    await expect(
      adapter.request(
        { ...credentials, siteUrl: "https://jiraalign.com.evil.test" },
        {
          method: "GET",
          path: "/Epics",
        },
      ),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/rest/align/api/2/Epics",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/Epics",
        json: { apiToken: "leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
