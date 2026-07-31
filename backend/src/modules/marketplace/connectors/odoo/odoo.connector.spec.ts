import { ODOO_CONNECTOR_MANIFEST } from "./odoo.connector";

describe("Odoo connector manifest", () => {
  it("publishes two encrypted connection fields and three typed reads", () => {
    expect(ODOO_CONNECTOR_MANIFEST).toMatchObject({
      slug: "odoo",
      connectorType: "native_clawchat",
      auth: { type: "api_key" },
    });
    expect(
      ODOO_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.secret,
      ]),
    ).toEqual([
      ["ODOO_DATABASE", false],
      ["ODOO_API_KEY", true],
    ]);
    expect(ODOO_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "odoo.getCurrentUser",
      "odoo.listProjects",
      "odoo.getProject",
    ]);
  });

  it("requires Safe approval and preserves hard blocks in Dangerous mode", () => {
    const [safe, dangerous] = ODOO_CONNECTOR_MANIFEST.approvalProfiles;
    const reads = ["odoo_user_get", "odoo_project_list", "odoo_project_get"];
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "odoo_record_mutation",
        "odoo_private_business_data",
        "odoo_raw_api",
        "odoo_bulk_export",
      ]),
    );
  });
});
