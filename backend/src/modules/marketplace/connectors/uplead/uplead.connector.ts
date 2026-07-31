import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const usageRead = action(
  "uplead_credit_balance_get",
  "Read credit balance",
  "Read only the connected UpLead account's remaining credit count without returning its email or accessing contact or company records.",
);
const blocks = [
  blocked(
    "uplead_people_company_and_intent_data",
    "Block people, company, and intent data",
    "Person, company and combined lookup, enrichment, emails, phones, employment, education, location, social profiles, firmographics, technographics, intent and company news are unavailable.",
  ),
  blocked(
    "uplead_prospecting_preview_lists_and_exports",
    "Block prospecting, preview, lists, and exports",
    "Prospector and Prospector Pro, Preview API, quick search, lists, CRM sync, downloads, exports, exclusions, browser extensions, batching and pagination are unavailable.",
  ),
  blocked(
    "uplead_admin_and_raw_access",
    "Block administration and raw access",
    "API-key management, user and credit allocation, purchases, arbitrary endpoints, raw REST, retries, browser sessions, platform credentials and unrestricted tools are unavailable.",
  ),
];

export const UPLEAD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "uplead",
  name: "UpLead",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.uplead.com/",
  providerWebsiteUrl: "https://www.uplead.com/",
  capabilities: [
    {
      ...capability(
        "account_usage_read",
        "Read credit balance",
        "Read a reduced remaining-credit snapshot without accessing UpLead's people or company database.",
        true,
      ),
      platformCapability: "account_usage_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "UPLEAD_API_KEY",
        label: "UpLead API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned key from UpLead account settings. Relay encrypts it and permits only the fixed remaining-credit read.",
      },
    ],
  },
  tools: [
    {
      name: "relay_uplead_get_credit_balance",
      functionName: "relay_uplead_get_credit_balance",
      aliases: ["uplead_credit_balance_get"],
      capability: "account_usage_read",
      platformCapability: "account_usage_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the remaining UpLead credit count through one fixed request, excluding the account email.",
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
      id: "uplead_safe",
      label: "Safe",
      description:
        "The reduced credit-balance read runs automatically. People, company and intent data, prospecting, preview, lists, exports, administration and raw access remain blocked.",
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
      label: "Customer-owned UpLead API key with credits-endpoint access",
    },
  ],
};
