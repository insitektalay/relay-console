import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const companySearch = action(
  "seamless_company_search",
  "Search companies",
  "Search for at most five companies by one explicit name or root domain and return reduced company-only data without starting research or exposing contacts.",
);
const blocks = [
  blocked(
    "seamless_people_contact_data",
    "Block people and contact data",
    "Contact search, personal and professional contact details, profiles, saved contacts and people enrichment are unavailable.",
  ),
  blocked(
    "seamless_research_outreach_campaigns",
    "Block research and outreach",
    "Credit-consuming research, lists, exports, CRM sync, email, calls, tasks, templates, campaigns, saved searches and outreach are unavailable.",
  ),
  blocked(
    "seamless_mcp_admin_bulk_raw",
    "Block MCP, administration, bulk, and raw access",
    "Provider-hosted MCP, resources, API-key management, arbitrary endpoints, webhooks, bulk input, retries, pagination, browser sessions and unrestricted tools are unavailable.",
  ),
];

export const SEAMLESS_AI_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "seamless-ai",
  name: "Seamless.AI",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.seamless.ai/introduction",
  providerWebsiteUrl: "https://seamless.ai/",
  capabilities: [
    {
      ...capability(
        "company_search",
        "Search companies",
        "Search a reduced company-only index by one explicit name or domain, capped at five results and without research credits.",
        true,
      ),
      platformCapability: "company_search",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SEAMLESS_API_KEY",
        label: "Seamless.AI API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated customer-owned key with Public API v1 access. Relay encrypts it and permits only the fixed bounded company-search endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "relay_seamless_search_companies",
      functionName: "relay_seamless_search_companies",
      aliases: ["seamless_company_search"],
      capability: "company_search",
      platformCapability: "company_search",
      action: "read",
      approvalRequired: false,
      description:
        "Search at most five companies by one explicit name or root domain through Seamless.AI's fixed company-search endpoint.",
      inputSchema: {
        type: "object",
        properties: {
          companyName: { type: "string", minLength: 2, maxLength: 160 },
          companyDomain: { type: "string", minLength: 4, maxLength: 253 },
          matchType: {
            type: "string",
            enum: ["default", "related", "exact"],
            default: "exact",
          },
          limit: { type: "integer", minimum: 1, maximum: 5, default: 5 },
        },
        anyOf: [{ required: ["companyName"] }, { required: ["companyDomain"] }],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "seamless_safe",
      label: "Safe",
      description:
        "One bounded company-only search runs automatically. People data, research, outreach, campaigns, MCP, administration, bulk and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: [companySearch],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same bounded company-only search runs without approval; the broad API key never expands Relay's fixed endpoint, input or output contract.",
      defaultSelected: false,
      allowedActions: [companySearch],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "customer_api_key",
      label: "Customer-owned Seamless.AI key with Public API v1 access",
    },
  ],
};
