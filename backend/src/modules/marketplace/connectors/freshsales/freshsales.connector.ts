import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "freshsales_contact_filters_list",
    "List contact-filter metadata",
    "List at most 100 contact filter IDs and names for one exact Freshsales account.",
  ),
];

const blockedActions = [
  blocked(
    "freshsales_crm_records",
    "Access CRM records",
    "Contacts, accounts, deals, products, activities, tasks, appointments, notes, conversations, files, and record fields are blocked.",
  ),
  blocked(
    "freshsales_private_filter_logic",
    "Access private filter logic",
    "Filter criteria, queries, ownership, sharing, counts, and filtered record results are blocked.",
  ),
  blocked(
    "freshsales_mutation_administration",
    "Mutate or administer Freshsales",
    "Creates, updates, deletes, upserts, team changes, imports, exports, workflows, users, roles, and settings changes are blocked.",
  ),
  blocked(
    "freshsales_raw_bulk",
    "Use raw or bulk API access",
    "Arbitrary paths, embeds, selectors, views, search, raw responses, bulk access, pagination, redirects, and retries are blocked.",
  ),
];

export const FRESHSALES_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "freshsales",
  name: "Freshsales",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.freshworks.com/crm/api/",
  providerWebsiteUrl: "https://www.freshworks.com/crm/sales/",
  capabilities: [
    {
      ...capability(
        "contact_filter_metadata",
        "List contact-filter metadata",
        "List bounded projected filter IDs and names without filter logic or CRM records.",
        true,
      ),
      platformCapability: "freshsales_contact_filter_metadata",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FRESHSALES_API_KEY",
        label: "Freshsales API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "FRESHSALES_API_BASE_URL",
        label: "Freshsales API base URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the exact HTTPS Freshworks CRM account URL ending in /crm/sales.",
      },
    ],
  },
  tools: [
    {
      name: "freshsales.listContactFilters",
      functionName: "freshsales_contact_filters_list",
      aliases: [
        "freshsales.listContactFilters",
        "freshsales_contact_filters_list",
      ],
      capability: "contact_filter_metadata",
      platformCapability: "freshsales_contact_filter_metadata",
      action: "read",
      approvalRequired: true,
      description:
        "List strictly projected Freshsales contact-filter metadata.",
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
      id: "freshsales_contact_filter_metadata_safe",
      label: "Safe",
      description:
        "The bounded filter-metadata read requires approval; CRM records, private filter logic, writes, administration, bulk, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded metadata read runs without per-action approval; exact account/path binding, projection, caps, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "contact_filter_metadata_read",
      label: "Contact-filter credential check",
    },
  ],
};
