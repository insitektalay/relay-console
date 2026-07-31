import { AGILE_CRM_CONNECTOR_MANIFEST } from "./agile-crm.connector";

describe("Agile CRM connector manifest", () => {
  it("publishes three bound credentials and two typed Deal reads", () => {
    expect(AGILE_CRM_CONNECTOR_MANIFEST).toMatchObject({
      slug: "agile-crm",
      connectorType: "native_clawchat",
      auth: { type: "api_key" },
    });
    expect(
      AGILE_CRM_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.required,
        field.storedIn,
      ]),
    ).toEqual([
      ["AGILE_CRM_DOMAIN", true, "encrypted_secret"],
      ["AGILE_CRM_EMAIL", true, "encrypted_secret"],
      ["AGILE_CRM_API_KEY", true, "encrypted_secret"],
    ]);
    expect(AGILE_CRM_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      ["agileCrm.listDeals", "agileCrm.getDeal"],
    );
  });

  it("requires Safe approval and keeps hard guards in Dangerous mode", () => {
    const [safe, dangerous] = AGILE_CRM_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual([
      "agile_crm_deal_list",
      "agile_crm_deal_get",
    ]);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual([
      "agile_crm_deal_list",
      "agile_crm_deal_get",
    ]);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "agile_crm_record_mutation",
        "agile_crm_private_data",
        "agile_crm_raw_rest",
        "agile_crm_bulk_export",
      ]),
    );
  });
});
