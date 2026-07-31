import { SAGE_INTACCT_CONNECTOR_MANIFEST } from "./sage-intacct.connector";

describe("Sage Intacct connector manifest", () => {
  it("publishes three encrypted connection fields and two typed reads", () => {
    expect(SAGE_INTACCT_CONNECTOR_MANIFEST).toMatchObject({
      slug: "sage-intacct",
      connectorType: "native_clawchat",
      auth: { type: "api_key" },
    });
    expect(
      SAGE_INTACCT_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.secret,
      ]),
    ).toEqual([
      ["SAGE_INTACCT_CLIENT_ID", false],
      ["SAGE_INTACCT_CLIENT_SECRET", true],
      ["SAGE_INTACCT_USERNAME", false],
    ]);
    expect(
      SAGE_INTACCT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "sage-intacct.listReportingPeriods",
      "sage-intacct.getReportingPeriod",
    ]);
  });

  it("requires Safe approval and preserves hard blocks in Dangerous mode", () => {
    const [safe, dangerous] = SAGE_INTACCT_CONNECTOR_MANIFEST.approvalProfiles;
    const reads = [
      "sage_intacct_reporting_period_list",
      "sage_intacct_reporting_period_get",
    ];
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "sage_intacct_record_mutation",
        "sage_intacct_private_business_data",
        "sage_intacct_raw_api",
        "sage_intacct_bulk_export",
      ]),
    );
  });
});
