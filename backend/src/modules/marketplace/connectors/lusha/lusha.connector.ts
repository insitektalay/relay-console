import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const usageRead = action(
  "lusha_account_usage_get",
  "Read account usage",
  "Read the connected Lusha account's credits, plan, rate limits and action pricing without searching or revealing business-profile data.",
);
const blocks = [
  blocked(
    "lusha_contact_company_data",
    "Block business-profile data",
    "Contact and company search, enrichment, search-and-enrich, decision makers, PII reveal and all profile data are unavailable.",
  ),
  blocked(
    "lusha_prospecting_signals_automation",
    "Block prospecting and automation",
    "Prospecting, filters, lookalikes, recommendations, signals, website visits, CRM workflows, exports, outreach and bulk operations are unavailable.",
  ),
  blocked(
    "lusha_webhooks_admin_mcp_raw",
    "Block webhooks, administration and raw access",
    "Webhook subscriptions, delivery logs, webhook secrets, opt-out subscriptions, API-key management, provider-hosted MCP, arbitrary API, retries, pagination and browser sessions are unavailable.",
  ),
];

export const LUSHA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "lusha",
  name: "Lusha",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.lusha.com/apis/openapi/account/getaccountusage",
  providerWebsiteUrl: "https://www.lusha.com/",
  capabilities: [
    {
      ...capability(
        "account_usage_read",
        "Read account usage",
        "Read a reduced account-governance snapshot without accessing Lusha's business-profile database.",
        true,
      ),
      platformCapability: "account_usage_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LUSHA_API_KEY",
        label: "Lusha API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned key from Lusha API Hub. Relay encrypts it and permits only the fixed account-usage route.",
      },
    ],
  },
  tools: [
    {
      name: "relay_lusha_get_account_usage",
      functionName: "relay_lusha_get_account_usage",
      aliases: ["lusha_account_usage_get"],
      capability: "account_usage_read",
      platformCapability: "account_usage_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read credits, plan, rate limits and pricing from one fixed Lusha V3 account endpoint.",
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
      id: "lusha_safe",
      label: "Safe",
      description:
        "The reduced account-usage read runs automatically. Business-profile data, prospecting, automation, webhooks, administration, MCP and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: [usageRead],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same single bounded governance read runs without approval; the full-account API key never expands Relay's fixed account-usage route.",
      defaultSelected: false,
      allowedActions: [usageRead],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "customer_api_key",
      label: "Customer-owned Lusha API key with Account Usage access",
    },
  ],
};
