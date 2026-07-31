import { LESS_ANNOYING_CRM_CONNECTOR_MANIFEST } from "./less-annoying-crm.connector";

describe("Less Annoying CRM connector manifest", () => {
  it("publishes one encrypted key and three typed reads", () => {
    expect(LESS_ANNOYING_CRM_CONNECTOR_MANIFEST).toMatchObject({
      slug: "less-annoying-crm",
      connectorType: "native_clawchat",
      auth: { type: "api_key" },
    });
    expect(LESS_ANNOYING_CRM_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual([
      expect.objectContaining({
        name: "LESS_ANNOYING_CRM_API_KEY",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
      }),
    ]);
    expect(
      LESS_ANNOYING_CRM_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "lessAnnoyingCrm.getCurrentUser",
      "lessAnnoyingCrm.searchContacts",
      "lessAnnoyingCrm.getContact",
    ]);
  });

  it("requires Safe approval and preserves hard blocks in Dangerous mode", () => {
    const [safe, dangerous] =
      LESS_ANNOYING_CRM_CONNECTOR_MANIFEST.approvalProfiles;
    const reads = [
      "less_annoying_crm_user_get",
      "less_annoying_crm_contact_search",
      "less_annoying_crm_contact_get",
    ];
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "less_annoying_crm_record_mutation",
        "less_annoying_crm_private_data",
        "less_annoying_crm_raw_api",
        "less_annoying_crm_bulk_export",
      ]),
    );
  });
});
