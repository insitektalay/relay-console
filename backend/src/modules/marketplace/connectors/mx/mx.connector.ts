import { partnerFinanceConnector } from "../partner-finance/partner-finance-connector.factory";

export const MX_CONNECTOR_MANIFEST = partnerFinanceConnector({
  slug: "mx",
  name: "MX",
  functionPrefix: "mx",
  docsUrl: "https://docs.mx.com/api-reference/platform-api-2026/",
  websiteUrl: "https://www.mx.com/",
  credentialSchema: [
    {
      name: "MX_API_ORIGIN",
      label: "MX API origin",
      required: true,
      secret: false,
      storedIn: "metadata",
      helpText:
        "Use https://api.mx.com or the official MX integration environment assigned to the customer.",
    },
    {
      name: "MX_CLIENT_ID",
      label: "MX client ID",
      required: true,
      secret: true,
      storedIn: "encrypted_secret",
    },
    {
      name: "MX_API_KEY",
      label: "MX API key",
      required: true,
      secret: true,
      storedIn: "encrypted_secret",
    },
  ],
  readDescription:
    "Read one bounded documented MX Platform API resource enabled for the customer's client.",
  fullDescription:
    "Use the complete documented MX Platform API surface authorized for the customer's client; Safe mode requires approval for mutations.",
});
