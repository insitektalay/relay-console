import { ZOHO_EXPENSE_CONNECTOR_MANIFEST } from "./zoho-expense.connector";
describe("Zoho Expense connector manifest", () => {
  it("publishes one settings scope, three fields, and one typed read", () => {
    expect(ZOHO_EXPENSE_CONNECTOR_MANIFEST).toMatchObject({
      slug: "zoho-expense",
      connectorType: "native_clawchat",
      auth: {
        type: "oauth2_authorization_code",
        oauth: { requiredScopes: ["ZohoExpense.orgsettings.READ"] },
      },
    });
    expect(
      ZOHO_EXPENSE_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.secret,
      ]),
    ).toEqual([
      ["ZOHO_EXPENSE_CLIENT_ID", false],
      ["ZOHO_EXPENSE_CLIENT_SECRET", true],
      ["ZOHO_EXPENSE_ORGANIZATION_ID", false],
    ]);
    expect(
      ZOHO_EXPENSE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["zohoExpense.getOrganization"]);
  });
  it("requires Safe approval and preserves hard blocks", () => {
    const [safe, dangerous] = ZOHO_EXPENSE_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual([
      "zoho_expense_organization_get",
    ]);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual([
      "zoho_expense_organization_get",
    ]);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "zoho_expense_record_mutation",
        "zoho_expense_private_business_data",
        "zoho_expense_raw_api",
        "zoho_expense_bulk_export",
      ]),
    );
  });
});
