import { partnerFinanceConnector } from "../partner-finance/partner-finance-connector.factory";

export const FINICITY_CONNECTOR_MANIFEST = partnerFinanceConnector({
  slug: "finicity",
  name: "Finicity",
  functionPrefix: "finicity",
  docsUrl: "https://developer.mastercard.com/open-banking-us/documentation/",
  websiteUrl: "https://www.finicity.com/",
  credentialSchema: [
    {
      name: "FINICITY_API_ORIGIN",
      label: "Finicity API origin",
      required: true,
      secret: false,
      storedIn: "metadata",
      helpText:
        "Use the fixed official Finicity API origin assigned to the customer.",
    },
    {
      name: "FINICITY_PARTNER_ID",
      label: "Finicity partner ID",
      required: true,
      secret: true,
      storedIn: "encrypted_secret",
    },
    {
      name: "FINICITY_PARTNER_SECRET",
      label: "Finicity partner secret",
      required: true,
      secret: true,
      storedIn: "encrypted_secret",
    },
    {
      name: "FINICITY_APP_KEY",
      label: "Finicity app key",
      required: true,
      secret: true,
      storedIn: "encrypted_secret",
    },
  ],
  readDescription:
    "Read one bounded documented Finicity Open Finance resource enabled for the customer's partner account.",
  fullDescription:
    "Use the complete documented Finicity Open Finance API surface authorized for the customer; Safe mode requires approval for mutations.",
});
