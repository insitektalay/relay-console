import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "appcues_flows_list",
    "List flows",
    "List at most 50 flow IDs, names, publication states, frequencies, and lifecycle timestamps for one exact account.",
  ),
];
const blockedActions = [
  blocked(
    "appcues_private_flow_data",
    "Access private flow data",
    "Flow step content, screenshots, creator/updater identities, tags, URLs, targeting, translations, and experience payloads are blocked.",
  ),
  blocked(
    "appcues_users_segments_data",
    "Access users, groups, or segments",
    "User profiles, events, identities, groups, segment membership, exports, imports, raw event data, and bulk data are blocked.",
  ),
  blocked(
    "appcues_mutation_admin",
    "Mutate or administer Appcues",
    "Publishing, unpublishing, profile updates, event tracking, segment changes, imports, filters, SDK keys, enforcement modes, and administration are blocked.",
  ),
  blocked(
    "appcues_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary accounts or origins, CSV/NDJSON, pagination, polling, retries, batches, downloads, screenshots, and provider-response pass-through are blocked.",
  ),
];

export const APPCUES_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "appcues",
  name: "Appcues",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.appcues.com/v2/docs",
  providerWebsiteUrl: "https://www.appcues.com/",
  capabilities: [
    {
      ...capability(
        "flow_inventory",
        "List flows",
        "List bounded, strictly projected flow identity and publication metadata.",
        true,
      ),
      platformCapability: "appcues_flow_inventory",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "APPCUES_API_KEY",
        label: "Appcues API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "APPCUES_API_SECRET",
        label: "Appcues API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "APPCUES_ACCOUNT_ID",
        label: "Appcues account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "APPCUES_REGION",
        label: "Appcues region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter us or eu to match the account's data region.",
      },
    ],
  },
  tools: [
    {
      name: "appcues.listFlows",
      functionName: "appcues_flows_list",
      aliases: ["appcues.listFlows", "appcues_flows_list"],
      capability: "flow_inventory",
      platformCapability: "appcues_flow_inventory",
      action: "read",
      approvalRequired: true,
      description:
        "List strictly projected Appcues flow inventory metadata for one exact account.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 50, default: 50 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "appcues_flow_inventory_safe",
      label: "Safe",
      description:
        "The bounded flow inventory requires approval; private content, users, segments, writes, bulk data, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded flow inventory runs without Relay per-action approval; exact account/region binding, strict projection, response cap, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "flow_inventory_read", label: "Flow inventory credential check" },
  ],
};
