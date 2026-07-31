import { ZOHO_INVOICE_CONNECTOR_MANIFEST } from "./zoho-invoice.connector";
describe("Zoho Invoice connector manifest", () => {
  it("publishes one settings scope, three fields, and one typed read", () => {
    expect(ZOHO_INVOICE_CONNECTOR_MANIFEST).toMatchObject({
      slug: "zoho-invoice",
      connectorType: "native_clawchat",
      auth: {
        type: "oauth2_authorization_code",
        oauth: { requiredScopes: ["ZohoInvoice.settings.READ"] },
      },
    });
    expect(
      ZOHO_INVOICE_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.secret,
      ]),
    ).toEqual([
      ["ZOHO_INVOICE_CLIENT_ID", false],
      ["ZOHO_INVOICE_CLIENT_SECRET", true],
      ["ZOHO_INVOICE_ORGANIZATION_ID", false],
    ]);
    expect(
      ZOHO_INVOICE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["zohoInvoice.getOrganization"]);
  });
  it("requires Safe approval and preserves hard blocks", () => {
    const [safe, dangerous] = ZOHO_INVOICE_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual([
      "zoho_invoice_organization_get",
    ]);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual([
      "zoho_invoice_organization_get",
    ]);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "zoho_invoice_record_mutation",
        "zoho_invoice_private_business_data",
        "zoho_invoice_raw_api",
        "zoho_invoice_bulk_export",
      ]),
    );
  });
});
