import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "custify_segments_list",
    "List segments",
    "List at most 50 projected segment identities for one type and exact Custify environment.",
  ),
];
const blockedActions = [
  blocked(
    "custify_customer_person_data",
    "Access customer or person data",
    "Companies, people, attributes, health, lifecycle, revenue, NPS, tickets, files, and customer values are blocked.",
  ),
  blocked(
    "custify_private_engagement_data",
    "Access private engagement data",
    "Segment goals, tags, memberships, notes, tasks, comments, playbooks, events, surveys, and content are blocked.",
  ),
  blocked(
    "custify_mutation_delete",
    "Mutate or delete Custify data",
    "Creates, updates, deletes, imports, event tracking, scores, deals, replies, uploads, and administration are blocked.",
  ),
  blocked(
    "custify_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary origins, filters, sorting, pagination beyond page one, exports, retries, and response pass-through are blocked.",
  ),
];

export const CUSTIFY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "custify",
  name: "Custify",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.custify.com/",
  providerWebsiteUrl: "https://www.custify.com/",
  capabilities: [
    {
      ...capability(
        "segment_inventory",
        "List segments",
        "List bounded projected segment metadata without goals, tags, membership, or customer data.",
        true,
      ),
      platformCapability: "custify_segment_inventory",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CUSTIFY_API_KEY",
        label: "Custify API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "CUSTIFY_API_ORIGIN",
        label: "Custify API origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the exact HTTPS custify.com API origin shown in Settings → Developers → API Key.",
      },
    ],
  },
  tools: [
    {
      name: "custify.listSegments",
      functionName: "custify_segments_list",
      aliases: ["custify.listSegments", "custify_segments_list"],
      capability: "segment_inventory",
      platformCapability: "custify_segment_inventory",
      action: "read",
      approvalRequired: true,
      description: "List strictly projected Custify segment identity metadata.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 50, default: 50 },
          type: {
            type: "string",
            enum: ["company", "people"],
            default: "company",
          },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "custify_segment_inventory_safe",
      label: "Safe",
      description:
        "The bounded segment read requires approval; customer, engagement, mutation, bulk, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded segment read runs without Relay per-action approval; exact origin/path/query binding, projection, caps, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "segment_inventory_read", label: "Segment credential check" },
  ],
};
