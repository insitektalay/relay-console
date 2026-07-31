import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "insightly_custom_fields_list",
    "List custom-field metadata",
    "List at most 100 projected custom-field definitions for one exact Insightly pod.",
  ),
];
const blockedActions = [
  blocked(
    "insightly_crm_records",
    "Access CRM records",
    "Contacts, organizations, leads, opportunities, projects, tasks, events, emails, notes, products, quotes, tickets, and custom-object records are blocked.",
  ),
  blocked(
    "insightly_private_schema_logic",
    "Access private schema logic",
    "Help text, defaults, options, dependencies, joins, calculated logic, and record values are blocked.",
  ),
  blocked(
    "insightly_mutation_administration",
    "Mutate or administer Insightly",
    "Creates, updates, deletes, links, tags, files, imports, exports, users, teams, webhooks, and settings changes are blocked.",
  ),
  blocked(
    "insightly_raw_bulk",
    "Use raw or bulk API access",
    "Arbitrary paths, search, filtered records, raw responses, bulk access, later pages, redirects, and retries are blocked.",
  ),
];

export const INSIGHTLY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "insightly",
  name: "Insightly",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.na1.insightly.com/v3.1/",
  providerWebsiteUrl: "https://www.insightly.com/",
  capabilities: [
    {
      ...capability(
        "custom_field_metadata",
        "List custom-field metadata",
        "List bounded projected field metadata without help text, defaults, options, dependencies, joins, or CRM records.",
        true,
      ),
      platformCapability: "insightly_custom_field_metadata",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "INSIGHTLY_API_KEY",
        label: "Insightly API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "INSIGHTLY_API_BASE_URL",
        label: "Insightly API base URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the exact HTTPS api.<pod>.insightly.com URL ending in /v3.1.",
      },
    ],
  },
  tools: [
    {
      name: "insightly.listCustomFields",
      functionName: "insightly_custom_fields_list",
      aliases: ["insightly.listCustomFields", "insightly_custom_fields_list"],
      capability: "custom_field_metadata",
      platformCapability: "insightly_custom_field_metadata",
      action: "read",
      approvalRequired: true,
      description: "List strictly projected Insightly custom-field metadata.",
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
      id: "insightly_custom_field_metadata_safe",
      label: "Safe",
      description:
        "The bounded field-metadata read requires approval; CRM records, private schema logic, writes, administration, bulk, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded metadata read runs without per-action approval; exact pod/path binding, projection, caps, audits, and no-write behavior remain enforced.",
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
