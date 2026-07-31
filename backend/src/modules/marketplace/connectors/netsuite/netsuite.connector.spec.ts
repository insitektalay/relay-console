import { NETSUITE_CONNECTOR_MANIFEST } from "./netsuite.connector";

describe("NetSuite connector manifest", () => {
  it("publishes six encrypted connection fields and two typed reads", () => {
    expect(NETSUITE_CONNECTOR_MANIFEST).toMatchObject({
      slug: "netsuite",
      connectorType: "native_clawchat",
      auth: { type: "api_key" },
    });
    expect(
      NETSUITE_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.secret,
      ]),
    ).toEqual([
      ["NETSUITE_ACCOUNT_ID", false],
      ["NETSUITE_SUITETALK_ORIGIN", false],
      ["NETSUITE_CONSUMER_KEY", true],
      ["NETSUITE_CONSUMER_SECRET", true],
      ["NETSUITE_TOKEN_ID", true],
      ["NETSUITE_TOKEN_SECRET", true],
    ]);
    expect(NETSUITE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "netsuite.listAccountingPeriods",
      "netsuite.getAccountingPeriod",
    ]);
  });

  it("requires Safe approval and preserves hard blocks in Dangerous mode", () => {
    const [safe, dangerous] = NETSUITE_CONNECTOR_MANIFEST.approvalProfiles;
    const reads = [
      "netsuite_accounting_period_list",
      "netsuite_accounting_period_get",
    ];
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "netsuite_record_mutation",
        "netsuite_private_business_data",
        "netsuite_raw_api",
        "netsuite_bulk_export",
      ]),
    );
  });
});
