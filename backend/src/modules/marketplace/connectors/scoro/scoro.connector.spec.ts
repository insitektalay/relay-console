import { SCORO_CONNECTOR_MANIFEST } from "./scoro.connector";

describe("Scoro connector manifest", () => {
  it("publishes three encrypted connection fields and three typed reads", () => {
    expect(SCORO_CONNECTOR_MANIFEST).toMatchObject({
      slug: "scoro",
      connectorType: "native_clawchat",
      auth: { type: "api_key" },
    });
    expect(
      SCORO_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.secret,
      ]),
    ).toEqual([
      ["SCORO_SITE", false],
      ["SCORO_COMPANY_ACCOUNT_ID", false],
      ["SCORO_API_KEY", true],
    ]);
    expect(SCORO_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "scoro.getBusinessEntity",
      "scoro.listProjects",
      "scoro.getProject",
    ]);
  });

  it("requires Safe approval and preserves hard blocks in Dangerous mode", () => {
    const [safe, dangerous] = SCORO_CONNECTOR_MANIFEST.approvalProfiles;
    const reads = [
      "scoro_business_entity_get",
      "scoro_project_list",
      "scoro_project_get",
    ];
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "scoro_record_mutation",
        "scoro_private_business_data",
        "scoro_raw_api",
        "scoro_bulk_export",
      ]),
    );
  });
});
