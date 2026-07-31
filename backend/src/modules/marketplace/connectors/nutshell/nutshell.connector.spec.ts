import { NUTSHELL_CONNECTOR_MANIFEST } from "./nutshell.connector";

describe("Nutshell connector manifest", () => {
  it("publishes two encrypted connection fields and two typed reads", () => {
    expect(NUTSHELL_CONNECTOR_MANIFEST).toMatchObject({
      slug: "nutshell",
      connectorType: "native_clawchat",
      auth: { type: "api_key" },
    });
    expect(
      NUTSHELL_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.secret,
      ]),
    ).toEqual([
      ["NUTSHELL_EMAIL", false],
      ["NUTSHELL_API_KEY", true],
    ]);
    expect(NUTSHELL_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "nutshell.searchLeads",
      "nutshell.getLead",
    ]);
  });

  it("requires Safe approval and preserves hard blocks in Dangerous mode", () => {
    const [safe, dangerous] = NUTSHELL_CONNECTOR_MANIFEST.approvalProfiles;
    const reads = ["nutshell_lead_search", "nutshell_lead_get"];
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "nutshell_record_mutation",
        "nutshell_private_crm",
        "nutshell_raw_api",
        "nutshell_bulk_export",
      ]),
    );
  });
});
