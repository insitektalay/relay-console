import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const usageRead = action(
  "leadiq_account_usage_get",
  "Read account usage",
  "Read the connected LeadIQ account's subscribed plans and Universal Credit balance without searching for or revealing people or company data.",
);
const blocks = [
  blocked(
    "leadiq_people_company_data",
    "Block people and company data",
    "People and company search, enrichment, personal and professional contact details, employment, education, location, firmographics, technographics and funding data are unavailable.",
  ),
  blocked(
    "leadiq_prospecting_lists_exports_and_feedback",
    "Block prospecting, lists, exports, and feedback",
    "Advanced prospecting, filters, job-change signals, lists, prospect creation, CSV export, CRM workflows, data feedback, outreach, batching and pagination are unavailable.",
  ),
  blocked(
    "leadiq_mcp_admin_and_raw_access",
    "Block MCP, administration, and raw access",
    "Provider-hosted MCP, API-key management, Workato tokens, arbitrary GraphQL, introspection, raw REST, retries, browser sessions, platform credentials and unrestricted tools are unavailable.",
  ),
];

export const LEADIQ_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "leadiq",
  name: "LeadIQ",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://leadiqhelp.zendesk.com/hc/en-us/articles/29375289152795-LeadIQ-Public-API-Guide",
  providerWebsiteUrl: "https://leadiq.com/",
  capabilities: [
    {
      ...capability(
        "account_usage_read",
        "Read account usage",
        "Read a reduced account-governance snapshot without accessing LeadIQ's people or company database.",
        true,
      ),
      platformCapability: "account_usage_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LEADIQ_API_KEY",
        label: "LeadIQ API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned Base64 API key from LeadIQ Settings. Relay encrypts it and permits only the fixed no-credit account query.",
      },
    ],
  },
  tools: [
    {
      name: "relay_leadiq_get_account_usage",
      functionName: "relay_leadiq_get_account_usage",
      aliases: ["leadiq_account_usage_get"],
      capability: "account_usage_read",
      platformCapability: "account_usage_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read subscribed plan status and Universal Credit usage through one fixed LeadIQ GraphQL account query.",
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
      id: "leadiq_safe",
      label: "Safe",
      description:
        "The reduced no-credit account read runs automatically. People and company data, prospecting, lists, exports, feedback, MCP, administration and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: [usageRead],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same single bounded governance read runs without approval; the full-account API key never expands Relay's fixed GraphQL query.",
      defaultSelected: false,
      allowedActions: [usageRead],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "customer_api_key",
      label: "Customer-owned LeadIQ API key with account-query access",
    },
  ],
};
