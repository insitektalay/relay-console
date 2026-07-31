import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "userpilot_feature_event_definitions_list",
    "List feature and event definitions",
    "List at most 100 tracked feature/event keys, display names, and data types for one exact environment.",
  ),
];
const blockedActions = [
  blocked(
    "userpilot_user_company_data",
    "Access user or company data",
    "Users, companies, IDs, properties, metadata, segments, profiles, and identity data are blocked.",
  ),
  blocked(
    "userpilot_analytics_content_data",
    "Access analytics or content data",
    "Analytics exports, events, sessions, flows, banners, embeds, spotlights, checklists, surveys, and resource-center data are blocked.",
  ),
  blocked(
    "userpilot_mutation_delete",
    "Mutate or delete Userpilot data",
    "Identify, profile updates, event tracking, imports, bulk updates, deletion jobs, and administration are blocked.",
  ),
  blocked(
    "userpilot_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, non-Userpilot origins, pagination, polling, retries, batches, exports, downloads, and provider-response pass-through are blocked.",
  ),
];

export const USERPILOT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "userpilot",
  name: "Userpilot",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.userpilot.com/api-references/endpoints/lookups/features-events",
  providerWebsiteUrl: "https://userpilot.com/",
  capabilities: [
    {
      ...capability(
        "feature_event_inventory",
        "List feature and event definitions",
        "List bounded, strictly projected tracked feature/event definitions.",
        true,
      ),
      platformCapability: "userpilot_feature_event_inventory",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "USERPILOT_ENVIRONMENT_API_KEY",
        label: "Userpilot environment API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "USERPILOT_EXPORT_API_ORIGIN",
        label: "Userpilot export API origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use https://appex.userpilot.io unless Userpilot provides a dedicated userpilot.io export origin for the environment.",
      },
    ],
  },
  tools: [
    {
      name: "userpilot.listFeatureEventDefinitions",
      functionName: "userpilot_feature_event_definitions_list",
      aliases: [
        "userpilot.listFeatureEventDefinitions",
        "userpilot_feature_event_definitions_list",
      ],
      capability: "feature_event_inventory",
      platformCapability: "userpilot_feature_event_inventory",
      action: "read",
      approvalRequired: true,
      description:
        "List strictly projected Userpilot feature/event definitions for one exact environment.",
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
      id: "userpilot_feature_event_inventory_safe",
      label: "Safe",
      description:
        "The bounded definition inventory requires approval; user/company data, analytics, content, writes, deletes, bulk data, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded definition inventory runs without Relay per-action approval; exact origin binding, strict projection, response cap, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "feature_event_inventory_read",
      label: "Feature/event inventory credential check",
    },
  ],
};
