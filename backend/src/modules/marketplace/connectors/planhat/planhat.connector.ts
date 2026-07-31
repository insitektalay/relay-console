import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [
  action(
    "planhat_custom_fields_list",
    "List custom-field metadata",
    "List at most 100 projected custom-field definitions for one exact Planhat environment.",
  ),
];
const blockedActions = [
  blocked(
    "planhat_customer_user_data",
    "Access customer or user data",
    "Companies, end users, users, health, revenue, metrics, NPS, and record values are blocked.",
  ),
  blocked(
    "planhat_private_schema_logic",
    "Access private schema logic",
    "Formulas, list values, filters, references, number formats, custom values, and full definitions are blocked.",
  ),
  blocked(
    "planhat_engagement_mutation",
    "Access engagement or mutate data",
    "Projects, tasks, notes, conversations, issues, tickets, campaigns, activities, creates, updates, deletes, and bulk upserts are blocked.",
  ),
  blocked(
    "planhat_raw_mcp_bulk",
    "Use raw, MCP, or bulk access",
    "Raw paths, arbitrary origins, remote MCP tools, model discovery, later pages, exports, retries, and pass-through are blocked.",
  ),
];
export const PLANHAT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "planhat",
  name: "Planhat",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.planhat.com/developers/api/custom-field",
  providerWebsiteUrl: "https://www.planhat.com/",
  capabilities: [
    {
      ...capability(
        "custom_field_metadata",
        "List custom-field metadata",
        "List bounded projected field metadata without formulas, options, filters, references, values, or customer records.",
        true,
      ),
      platformCapability: "planhat_custom_field_metadata",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PLANHAT_API_TOKEN",
        label: "Planhat API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "PLANHAT_API_ORIGIN",
        label: "Planhat API origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the exact HTTPS planhat.com API origin for the tenant cluster.",
      },
    ],
  },
  tools: [
    {
      name: "planhat.listCustomFields",
      functionName: "planhat_custom_fields_list",
      aliases: ["planhat.listCustomFields", "planhat_custom_fields_list"],
      capability: "custom_field_metadata",
      platformCapability: "planhat_custom_field_metadata",
      action: "read",
      approvalRequired: true,
      description: "List strictly projected Planhat custom-field metadata.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 100, default: 100 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "planhat_custom_field_metadata_safe",
      label: "Safe",
      description:
        "The bounded field-metadata read requires approval; customer data, private logic, engagement, writes, MCP, bulk, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded metadata read runs without per-action approval; exact origin/path/query binding, projection, caps, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "custom_field_metadata_read",
      label: "Custom-field credential check",
    },
  ],
};
