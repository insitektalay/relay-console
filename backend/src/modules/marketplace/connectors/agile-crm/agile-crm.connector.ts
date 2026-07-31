import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "agile_crm_deal_list",
    "List deals",
    "List at most twenty-five bounded Deal summaries from the first fixed page.",
  ),
  action(
    "agile_crm_deal_get",
    "Read deal",
    "Read one exact bounded Deal by positive numeric ID.",
  ),
];

const blockedActions = [
  blocked(
    "agile_crm_record_mutation",
    "Change CRM records",
    "Creating, updating, relating, moving, archiving, bulk-changing, or deleting Agile CRM records is outside V1.",
  ),
  blocked(
    "agile_crm_private_data",
    "Read private CRM data",
    "Contacts, companies, owners, users, email addresses, phone numbers, addresses, descriptions, notes, custom fields, tags, files, and relationships are outside V1.",
  ),
  blocked(
    "agile_crm_broader_product",
    "Access broader Agile CRM data",
    "Tasks, events, campaigns, documents, tickets, messages, tracks, milestones, telephony, marketing, service, administration, and webhooks are outside V1.",
  ),
  blocked(
    "agile_crm_raw_rest",
    "Call arbitrary REST endpoints",
    "Arbitrary hosts, paths, methods, queries, cursors, filters, bodies, and raw REST access are outside V1.",
  ),
  blocked(
    "agile_crm_bulk_export",
    "Export Agile CRM data",
    "Automatic pagination, crawling, synchronization, bulk APIs, and broad exports are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const AGILE_CRM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "agile-crm",
  name: "Agile CRM",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://github.com/agilecrm/rest-api",
  providerWebsiteUrl: "https://www.agilecrm.com/",
  capabilities: [
    {
      ...capability(
        "deal_read",
        "Read deals",
        "List bounded Deal summaries or inspect one exact Deal without contacts, owners, descriptions, custom data, notes, or relationships.",
        true,
      ),
      platformCapability: "agile_crm_deal_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "AGILE_CRM_DOMAIN",
        label: "Agile CRM domain",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter only the tenant prefix from {domain}.agilecrm.com; Relay constructs and pins the HTTPS API host.",
      },
      {
        name: "AGILE_CRM_EMAIL",
        label: "Agile CRM account email",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the email for a dedicated least-privilege Agile CRM user.",
      },
      {
        name: "AGILE_CRM_API_KEY",
        label: "Agile CRM REST API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the first REST client API key from Admin Settings > API & Analytics > API Key. Relay stores it encrypted.",
      },
    ],
  },
  tools: [
    {
      name: "agileCrm.listDeals",
      functionName: "agile_crm_deal_list",
      aliases: ["agileCrm.listDeals", "agile_crm_deal_list"],
      capability: "deal_read",
      platformCapability: "agile_crm_deal_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five bounded Deal summaries from the fixed first page.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "agileCrm.getDeal",
      functionName: "agile_crm_deal_get",
      aliases: ["agileCrm.getDeal", "agile_crm_deal_get"],
      capability: "deal_read",
      platformCapability: "agile_crm_deal_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Deal summary.",
      inputSchema: {
        type: "object",
        properties: {
          dealId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
          approvalId,
        },
        required: ["dealId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "agile_crm_safe",
      label: "Safe",
      description: "Both bounded private CRM reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both selected read-only tools run without Relay per-action approval while exact tenant and user binding, fixed paths and fields, provider authority, limits, audits, redaction, and API-key isolation remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "deals",
      label:
        "Agile CRM tenant, account email, REST API key, and Deal read validation",
    },
  ],
};
