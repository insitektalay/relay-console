import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const usageRead = action(
  "wiza_credit_balances_get",
  "Read credit balances",
  "Read only the connected Wiza account's email, phone, export and API credit balances without accessing professional or company data.",
);
const blocks = [
  blocked(
    "wiza_people_company_and_contact_data",
    "Block people, company, and contact data",
    "Individual reveals, emails, phones, LinkedIn profiles, employment, education, location, social data, prospect search and company enrichment are unavailable.",
  ),
  blocked(
    "wiza_bulk_lists_webhooks_and_exports",
    "Block bulk, lists, webhooks, and exports",
    "Bulk enrichment, list creation and retrieval, prospect lists, continued search, webhook delivery, CSV/JSON exports, CRM workflows, integrations, batching and pagination are unavailable.",
  ),
  blocked(
    "wiza_admin_financial_and_raw_access",
    "Block administration, financial actions, and raw access",
    "API-key management, assigned-user changes, credit purchases or allocation, arbitrary endpoints, raw REST, retries, browser sessions, platform credentials and unrestricted tools are unavailable.",
  ),
];

export const WIZA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "wiza",
  name: "Wiza",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.wiza.co/api-reference/credits/get-credits",
  providerWebsiteUrl: "https://wiza.co/",
  capabilities: [
    {
      ...capability(
        "account_usage_read",
        "Read credit balances",
        "Read a reduced credit-governance snapshot without accessing Wiza's professional or company data.",
        true,
      ),
      platformCapability: "account_usage_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "WIZA_API_KEY",
        label: "Wiza API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned key from Wiza API settings. Relay encrypts it and permits only the fixed credit-balances read.",
      },
    ],
  },
  tools: [
    {
      name: "relay_wiza_get_credit_balances",
      functionName: "relay_wiza_get_credit_balances",
      aliases: ["wiza_credit_balances_get"],
      capability: "account_usage_read",
      platformCapability: "account_usage_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read only email, phone, export and API credit balances through one fixed Wiza request.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "wiza_safe",
      label: "Safe",
      description:
        "The reduced credit-balances read runs automatically. People, company and contact data, bulk, lists, webhooks, exports, financial actions, administration and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: [usageRead],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same single bounded governance read runs without approval; the full-account API key never expands Relay's fixed credits request.",
      defaultSelected: false,
      allowedActions: [usageRead],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "customer_api_key",
      label: "Customer-owned Wiza API key with credit-balance access",
    },
  ],
};
