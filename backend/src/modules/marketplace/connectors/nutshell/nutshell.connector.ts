import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "nutshell_lead_search",
    "Search leads",
    "Search required text and return at most twenty-five bounded Lead summaries from fixed page zero.",
  ),
  action(
    "nutshell_lead_get",
    "Read lead",
    "Read one exact bounded Lead summary by canonical API ID.",
  ),
];
const blockedActions = [
  blocked(
    "nutshell_record_mutation",
    "Change Nutshell data",
    "Creating, updating, assigning, relating, tagging, closing, bulk-changing, or deleting Nutshell records is outside V1.",
  ),
  blocked(
    "nutshell_private_crm",
    "Read private CRM data",
    "Contacts, companies, owners, watchers, emails, phone numbers, addresses, descriptions, notes, custom fields, products, competitors, files, activities, communications, and relationships are outside V1.",
  ),
  blocked(
    "nutshell_broader_product",
    "Access broader Nutshell data",
    "Accounts, contacts, users, teams, territories, milestones, outcomes, sources, channels, reports, audiences, email sequences, marketing, forms, administration, SQL access, and webhooks are outside V1.",
  ),
  blocked(
    "nutshell_raw_api",
    "Call arbitrary Nutshell APIs",
    "Arbitrary paths, methods, filters, sorts, pages, limits, payloads, REST, GraphQL, JSON-RPC, MCP, or SQL access are outside V1.",
  ),
  blocked(
    "nutshell_bulk_export",
    "Export Nutshell data",
    "Empty-query enumeration, automatic pagination, crawling, synchronization, batch APIs, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const leadId = { type: "string", pattern: "^[1-9][0-9]{0,19}-leads$" };

export const NUTSHELL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "nutshell",
  name: "Nutshell",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.nutshell.com/docs/api-authentication",
  providerWebsiteUrl: "https://www.nutshell.com/",
  capabilities: [
    {
      ...capability(
        "lead_read",
        "Read leads",
        "Search with required text or inspect one exact Lead summary without people, companies, owners, communications, descriptions, notes, custom fields, products, files, activities, or relationships.",
        true,
      ),
      platformCapability: "nutshell_lead_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "NUTSHELL_EMAIL",
        label: "Nutshell user email",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the email address for the dedicated least-privilege Nutshell user bound to this connection.",
      },
      {
        name: "NUTSHELL_API_KEY",
        label: "Nutshell API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated key under Settings > Connections > API keys. Relay stores it encrypted and uses it only with the exact user email at app.nutshell.com.",
      },
    ],
  },
  tools: [
    {
      name: "nutshell.searchLeads",
      functionName: "nutshell_lead_search",
      aliases: ["nutshell.searchLeads", "nutshell_lead_search"],
      capability: "lead_read",
      platformCapability: "nutshell_lead_read",
      action: "read",
      approvalRequired: true,
      description:
        "Search required text and return at most twenty-five bounded Lead summaries from fixed page zero.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "nutshell.getLead",
      functionName: "nutshell_lead_get",
      aliases: ["nutshell.getLead", "nutshell_lead_get"],
      capability: "lead_read",
      platformCapability: "nutshell_lead_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Lead summary.",
      inputSchema: {
        type: "object",
        properties: { leadId, approvalId },
        required: ["leadId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "nutshell_safe",
      label: "Safe",
      description: "Both bounded private Lead reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both selected read-only tools run without Relay per-action approval while exact user and resource binding, fixed origin and paths, provider permissions, limits, audits, redaction, and API-key isolation remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "leads",
      label: "Nutshell user email, API key, and bounded Lead access validation",
    },
  ],
};
