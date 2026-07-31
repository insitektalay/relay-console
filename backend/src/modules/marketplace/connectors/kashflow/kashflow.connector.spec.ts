import { KASHFLOW_CONNECTOR_MANIFEST } from "./kashflow.connector";

describe("KashFlow connector manifest", () => {
  it("publishes two encrypted fields and two bounded SOAP reads", () => {
    expect(KASHFLOW_CONNECTOR_MANIFEST).toMatchObject({
      slug: "kashflow",
      connectorType: "native_clawchat",
      auth: { type: "api_key" },
    });
    expect(
      KASHFLOW_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => [
        field.name,
        field.secret,
        field.storedIn,
      ]),
    ).toEqual([
      ["KASHFLOW_USERNAME", true, "encrypted_secret"],
      ["KASHFLOW_API_PASSWORD", true, "encrypted_secret"],
    ]);
    expect(KASHFLOW_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "kashflow.listCurrencies",
      "kashflow.getVatRegistration",
    ]);
  });

  it("requires Safe approval and preserves the hard blocks in Dangerous mode", () => {
    const [safe, dangerous] = KASHFLOW_CONNECTOR_MANIFEST.approvalProfiles;
    const reads = ["kashflow_currency_list", "kashflow_vat_registration_get"];
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "kashflow_record_mutation",
        "kashflow_private_business_data",
        "kashflow_financial_and_broader_product",
        "kashflow_raw_api",
        "kashflow_bulk_export",
      ]),
    );
  });
});
