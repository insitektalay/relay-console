import { ZOHO_PROJECTS_CONNECTOR_MANIFEST } from "./zoho-projects.connector";

describe("Zoho Projects connector manifest", () => {
  it("publishes exact scopes, portal binding, and three bounded reads", () => {
    expect(ZOHO_PROJECTS_CONNECTOR_MANIFEST).toMatchObject({ slug: "zoho-projects", connectorType: "native_clawchat", auth: { type: "oauth2_authorization_code", oauth: { requiredScopes: ["ZohoProjects.portals.READ", "ZohoProjects.projects.READ", "ZohoProjects.tasks.READ"] } } });
    expect(ZOHO_PROJECTS_CONNECTOR_MANIFEST.auth.credentialSchema.map((item) => item.name)).toEqual(["ZOHO_PROJECTS_PORTAL_ID"]);
    expect(ZOHO_PROJECTS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["zohoProjects.listProjects", "zohoProjects.listTasks", "zohoProjects.getTask"]);
  });
  it("requires Safe approval and preserves hard blocks in Dangerous", () => {
    const [safe, dangerous] = ZOHO_PROJECTS_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions).toHaveLength(3);
    expect(dangerous.allowedActions).toHaveLength(3);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["zoho_projects_mutation", "zoho_projects_private_work_data", "zoho_projects_raw_search", "zoho_projects_bulk_export"]));
  });
});
