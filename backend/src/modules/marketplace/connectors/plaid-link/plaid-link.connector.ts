import { partnerFinanceConnector } from "../partner-finance/partner-finance-connector.factory";

export const PLAID_LINK_CONNECTOR_MANIFEST = partnerFinanceConnector({
  slug: "plaid-link",
  name: "Plaid Link",
  functionPrefix: "plaidLink",
  docsUrl: "https://plaid.com/docs/link/",
  websiteUrl: "https://plaid.com/",
  credentialSchema: [
    {
      name: "PLAID_API_ORIGIN",
      label: "Plaid API origin",
      required: true,
      secret: false,
      storedIn: "metadata",
      helpText:
        "Select the customer's exact Plaid Sandbox, Development, or Production environment.",
    },
    {
      name: "PLAID_CLIENT_ID",
      label: "Plaid client ID",
      required: true,
      secret: true,
      storedIn: "encrypted_secret",
    },
    {
      name: "PLAID_SECRET",
      label: "Plaid environment secret",
      required: true,
      secret: true,
      storedIn: "encrypted_secret",
    },
    {
      name: "PLAID_ACCESS_TOKEN",
      label: "Plaid Item access token",
      required: true,
      secret: true,
      storedIn: "encrypted_secret",
      helpText:
        "One Item access token produced by the customer's completed Plaid Link and public-token exchange flow.",
    },
  ],
  readDescription:
    "Read one bounded documented Plaid resource for the exact encrypted Item access token.",
  fullDescription:
    "Use the complete documented Plaid Item API surface authorized for the customer and linked Item; Safe mode requires approval for mutations and money movement.",
});
