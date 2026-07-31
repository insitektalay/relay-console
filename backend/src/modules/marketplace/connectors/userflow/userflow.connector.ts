import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "userflow_content_list",
    "List content",
    "List at most 50 content IDs, names, types, timestamps, and draft/published version IDs for one exact environment.",
  ),
];
const blockedActions = [
  blocked(
    "userflow_private_content_data",
    "Access private content data",
    "Labels, content versions, questions, tasks, answers, sessions, targeting, and full content payloads are blocked.",
  ),
  blocked(
    "userflow_users_groups_events",
    "Access users, groups, or events",
    "User profiles, attributes, groups, memberships, events, event definitions, and identity data are blocked.",
  ),
  blocked(
    "userflow_mutation_admin",
    "Mutate or administer Userflow",
    "User/group/event writes, session changes, webhooks, accounts, environments, members, invites, permissions, and administration are blocked.",
  ),
  blocked(
    "userflow_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary origins, personal API keys, pagination, polling, retries, batches, exports, downloads, and provider-response pass-through are blocked.",
  ),
];

export const USERFLOW_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "userflow",
  name: "Userflow",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.userflow.com/docs/api",
  providerWebsiteUrl: "https://www.userflow.com/",
  capabilities: [
    {
      ...capability(
        "content_inventory",
        "List content",
        "List bounded, strictly projected content identity and publication-version metadata.",
        true,
      ),
      platformCapability: "userflow_content_inventory",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "USERFLOW_ENVIRONMENT_API_KEY",
        label: "Userflow environment API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "USERFLOW_REGION",
        label: "Userflow region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter us or eu to match the key's environment region.",
      },
    ],
  },
  tools: [
    {
      name: "userflow.listContent",
      functionName: "userflow_content_list",
      aliases: ["userflow.listContent", "userflow_content_list"],
      capability: "content_inventory",
      platformCapability: "userflow_content_inventory",
      action: "read",
      approvalRequired: true,
      description:
        "List strictly projected Userflow content inventory for one exact environment.",
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
      id: "userflow_content_inventory_safe",
      label: "Safe",
      description:
        "The bounded content inventory requires approval; users, groups, events, sessions, writes, administration, bulk data, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded content inventory runs without Relay per-action approval; environment/region binding, strict projection, response cap, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "content_inventory_read",
      label: "Content inventory credential check",
    },
  ],
};
