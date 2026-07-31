import { SAGE_ACCOUNTING_CONNECTOR_MANIFEST } from "./sage-accounting.connector";

describe("SAGE_ACCOUNTING_CONNECTOR_MANIFEST", () => {
  it("uses customer-owned OAuth with refresh, APIM key, and fixed modern authority", () => {
    expect(SAGE_ACCOUNTING_CONNECTOR_MANIFEST.auth.type).toBe(
      "oauth2_authorization_code",
    );
    expect(SAGE_ACCOUNTING_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl:
        "https://www.sageone.com/oauth2/auth/central?filter=apiv3.1",
      tokenUrl: "https://oauth.accounting.sage.com/token",
      userInfoUrl: "https://api.accounting.sage.com/v3.1/businesses",
      requiredScopes: ["full_access"],
      pkce: false,
      supportsRefresh: true,
    });
    expect(
      SAGE_ACCOUNTING_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "SAGE_ACCOUNTING_CLIENT_ID",
      "SAGE_ACCOUNTING_CLIENT_SECRET",
      "SAGE_ACCOUNTING_SUBSCRIPTION_KEY",
    ]);
  });

  it("exposes only three approval-gated business-structure reads", () => {
    expect(SAGE_ACCOUNTING_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      SAGE_ACCOUNTING_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && tool.approvalRequired,
      ),
    ).toBe(true);
    expect(
      SAGE_ACCOUNTING_CONNECTOR_MANIFEST.tools.map((tool) => tool.functionName),
    ).toEqual([
      "sage_accounting_business_get",
      "sage_accounting_ledger_classification_list",
      "sage_accounting_ledger_classification_get",
    ]);
  });

  it("keeps Safe and Dangerous policy aligned while blocking broader accounting", () => {
    const [safe, dangerous] =
      SAGE_ACCOUNTING_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions).toHaveLength(3);
    expect(dangerous.allowedActions).toEqual(safe.approvalRequiredActions);
    expect(dangerous.approvalRequiredActions).toEqual([]);
    expect(dangerous.blockedActions).toEqual(safe.blockedActions);
    expect(safe.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "sage_accounting_record_mutation",
        "sage_accounting_private_business_data",
        "sage_accounting_financial_data",
        "sage_accounting_raw_api",
        "sage_accounting_bulk_export",
      ]),
    );
  });
});
