import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "totango_flows_list",
    "List flows",
    "List at most 30 flow identifiers, names, and low-risk status flags for one exact Totango region.",
  ),
];
const blockedActions = [
  blocked(
    "totango_customer_user_data",
    "Access customer or user data",
    "Accounts, users, attributes, health, lifecycle, assignments, usage, and customer record values are blocked.",
  ),
  blocked(
    "totango_events_engagement_data",
    "Access engagement data",
    "Events, touchpoints, tasks, objectives, campaigns, notes, content, participants, authors, and activity counts are blocked.",
  ),
  blocked(
    "totango_mutation_admin",
    "Mutate or administer Totango",
    "Creates, updates, deletes, uploads, triggers, user management, SCIM, configuration, and administration are blocked.",
  ),
  blocked(
    "totango_raw_search_bulk",
    "Use raw, search, or bulk access",
    "Raw paths, arbitrary origins, search APIs, pagination, exports, bulk jobs, retries, and response pass-through are blocked.",
  ),
];

export const TOTANGO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "totango",
  name: "Totango",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.totango.com/hc/en-us/articles/115000597266-Touchpoints-API",
  providerWebsiteUrl: "https://www.totango.com/",
  capabilities: [
    {
      ...capability(
        "flow_inventory",
        "List flows",
        "List bounded, strictly projected flow metadata without customer or engagement data.",
        true,
      ),
      platformCapability: "totango_flow_inventory",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TOTANGO_APP_TOKEN",
        label: "Totango app token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "TOTANGO_REGION",
        label: "Totango region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use us or eu to bind the fixed Totango API origin.",
      },
    ],
  },
  tools: [
    {
      name: "totango.listFlows",
      functionName: "totango_flows_list",
      aliases: ["totango.listFlows", "totango_flows_list"],
      capability: "flow_inventory",
      platformCapability: "totango_flow_inventory",
      action: "read",
      approvalRequired: true,
      description: "List strictly projected Totango flow metadata.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 30, default: 30 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "totango_flow_inventory_safe",
      label: "Safe",
      description:
        "The bounded flow-metadata read requires approval; customer, engagement, mutation, search, bulk, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded flow-metadata read runs without Relay per-action approval; fixed region/path binding, strict projection, response cap, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [{ id: "flow_inventory_read", label: "Flow credential check" }],
};
