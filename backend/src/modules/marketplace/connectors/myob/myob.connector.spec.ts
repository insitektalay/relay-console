import { MYOB_CONNECTOR_MANIFEST } from "./myob.connector";

describe("MYOB connector manifest", () => {
  it("publishes one narrow scope, three connection fields, and two typed reads", () => {
    expect(MYOB_CONNECTOR_MANIFEST).toMatchObject({
      slug: "myob",
      connectorType: "native_clawchat",
      auth: {
        type: "oauth2_authorization_code",
        oauth: { requiredScopes: ["sme-company-file"] },
      },
    });
    expect(
      MYOB_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.secret,
      ]),
    ).toEqual([
      ["MYOB_CLIENT_ID", false],
      ["MYOB_CLIENT_SECRET", true],
      ["MYOB_COMPANY_FILE_TOKEN", true],
    ]);
    expect(MYOB_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "myob.getCompanyFile",
      "myob.getApiInfo",
    ]);
  });

  it("requires Safe approval and preserves hard blocks in Dangerous mode", () => {
    const [safe, dangerous] = MYOB_CONNECTOR_MANIFEST.approvalProfiles;
    const reads = ["myob_company_file_get", "myob_api_info_get"];
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "myob_record_mutation",
        "myob_private_business_data",
        "myob_raw_api",
        "myob_bulk_export",
      ]),
    );
  });
});
