import { ZOHO_BOOKS_CONNECTOR_MANIFEST } from "./zoho-books.connector";

describe("Zoho Books connector manifest", () => {
  it("publishes one settings scope, three fields, and one typed read", () => {
    expect(ZOHO_BOOKS_CONNECTOR_MANIFEST).toMatchObject({
      slug: "zoho-books",
      connectorType: "native_clawchat",
      auth: {
        type: "oauth2_authorization_code",
        oauth: { requiredScopes: ["ZohoBooks.settings.READ"] },
      },
    });
    expect(
      ZOHO_BOOKS_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.secret,
      ]),
    ).toEqual([
      ["ZOHO_BOOKS_CLIENT_ID", false],
      ["ZOHO_BOOKS_CLIENT_SECRET", true],
      ["ZOHO_BOOKS_ORGANIZATION_ID", false],
    ]);
    expect(
      ZOHO_BOOKS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["zohoBooks.getOrganization"]);
  });
  it("requires Safe approval and preserves hard blocks in Dangerous mode", () => {
    const [safe, dangerous] = ZOHO_BOOKS_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual([
      "zoho_books_organization_get",
    ]);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual([
      "zoho_books_organization_get",
    ]);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "zoho_books_record_mutation",
        "zoho_books_private_business_data",
        "zoho_books_raw_api",
        "zoho_books_bulk_export",
      ]),
    );
  });
});
