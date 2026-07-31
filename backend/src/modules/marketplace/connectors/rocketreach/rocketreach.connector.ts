import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const usageRead = action(
  "rocketreach_account_usage_get",
  "Read account usage",
  "Read the connected RocketReach account's plan, Universal Credit usage and rate-limit governance without searching for or revealing people or company data.",
);
const blocks = [
  blocked(
    "rocketreach_people_company_data",
    "Block people and company data",
    "People and company search, lookup, enrichment, personal and professional contact details, employment, education, location, firmographics, healthcare and social-profile data are unavailable.",
  ),
  blocked(
    "rocketreach_bulk_exports_webhooks_and_community",
    "Block bulk, exports, webhooks, and community data",
    "Bulk jobs, exports, webhook administration, browser extensions, CRM workflows, the Community Program, outreach, batching and pagination are unavailable.",
  ),
  blocked(
    "rocketreach_mcp_admin_and_raw_access",
    "Block MCP, administration, and raw access",
    "Provider-hosted MCP, OAuth and dynamic client registration, API-key management, arbitrary endpoints, raw REST, retries, browser sessions, platform credentials and unrestricted tools are unavailable.",
  ),
];

export const ROCKETREACH_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "rocketreach",
  name: "RocketReach",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.rocketreach.co/reference/get_universal_account",
  providerWebsiteUrl: "https://rocketreach.co/",
  capabilities: [
    {
      ...capability(
        "account_usage_read",
        "Read account usage",
        "Read a reduced account-governance snapshot without accessing RocketReach's people or company database.",
        true,
      ),
      platformCapability: "account_usage_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ROCKETREACH_API_KEY",
        label: "RocketReach API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned key from RocketReach's API account page. Relay encrypts it and permits only the fixed Universal account-governance read.",
      },
    ],
  },
  tools: [
    {
      name: "relay_rocketreach_get_account_usage",
      functionName: "relay_rocketreach_get_account_usage",
      aliases: ["rocketreach_account_usage_get"],
      capability: "account_usage_read",
      platformCapability: "account_usage_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read reduced plan, Universal Credit and rate-limit governance through one fixed RocketReach account request.",
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
      id: "rocketreach_safe",
      label: "Safe",
      description:
        "The reduced account-governance read runs automatically. People and company data, bulk, exports, webhooks, community data, MCP, administration and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: [usageRead],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same single bounded governance read runs without approval; the full-account API key never expands Relay's fixed Universal account request.",
      defaultSelected: false,
      allowedActions: [usageRead],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "customer_api_key",
      label: "Customer-owned RocketReach API key with Universal account access",
    },
  ],
};
