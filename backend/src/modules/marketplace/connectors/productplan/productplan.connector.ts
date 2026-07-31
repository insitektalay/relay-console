import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "productplan_roadmaps_list",
    "List roadmaps",
    "List at most twenty bounded roadmap summaries visible to the token user.",
  ),
  action(
    "productplan_roadmap_get",
    "Read roadmap",
    "Read bounded metadata for one exact numeric roadmap ID.",
  ),
  action(
    "productplan_bars_list",
    "List roadmap bars",
    "List at most twenty bounded bars from one exact roadmap.",
  ),
  action(
    "productplan_bar_get",
    "Read bar",
    "Read bounded metadata for one exact numeric bar ID.",
  ),
];
const writes = [
  action(
    "productplan_bar_create",
    "Create parked bar",
    "Create one parked roadmap bar with bounded text and progress fields.",
  ),
  action(
    "productplan_bar_update",
    "Update bar metadata",
    "Update bounded title, description or progress on one exact bar.",
  ),
  action(
    "productplan_bar_delete",
    "Delete bar",
    "Permanently delete one exact bar only after its current name matches the supplied confirmation.",
  ),
];
const allActions = [...reads, ...writes];
const blockedActions = [
  blocked(
    "productplan_roadmap_structure",
    "Change roadmap structure",
    "Lanes, milestones, legends, placement, containers, child bars and roadmap structure are unavailable.",
  ),
  blocked(
    "productplan_bar_relationships",
    "Change bar relationships",
    "Connections, links, comments, custom fields and arbitrary tags are unavailable.",
  ),
  blocked(
    "productplan_strategy_discovery_launch",
    "Use broader ProductPlan modules",
    "Objectives, key results, initiatives, ideas, customers, launches, checklist sections and tasks are outside this bounded roadmap connection.",
  ),
  blocked(
    "productplan_users_teams_webhooks",
    "Manage users, teams or webhooks",
    "Account users, teams, authorization, webhook registration and administrative APIs are unavailable.",
  ),
  blocked(
    "productplan_raw_api",
    "Run arbitrary ProductPlan calls",
    "Agents cannot choose API origins, paths, query predicates, request bodies or raw API operations.",
  ),
  blocked(
    "productplan_unbounded",
    "Export ProductPlan data",
    "Twenty-row lists, one exact resource and 256 KiB responses are the maximum supported surface.",
  ),
];
const numericId = {
  type: "integer",
  minimum: 1,
  maximum: 9007199254740991,
};
const approvalId = { type: "string", maxLength: 200 };

export const PRODUCTPLAN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "productplan",
  name: "ProductPlan",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://productplan.readme.io/reference/overview",
  providerWebsiteUrl: "https://www.productplan.com/",
  capabilities: [
    {
      ...capability(
        "roadmap_read",
        "Read roadmaps",
        "List bounded roadmaps and inspect one exact roadmap.",
        true,
      ),
      platformCapability: "productplan_roadmap_read",
    },
    {
      ...capability(
        "bar_read",
        "Read roadmap bars",
        "List bounded bars in one roadmap and inspect one exact bar.",
        true,
      ),
      platformCapability: "productplan_bar_read",
    },
    {
      ...capability(
        "bar_write",
        "Manage roadmap bars",
        "Create parked bars, update bounded bar metadata and collision-safely delete one exact bar.",
        false,
      ),
      platformCapability: "productplan_bar_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PRODUCTPLAN_API_TOKEN",
        label: "ProductPlan API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A dedicated ProductPlan personal API token created by the intended least-authority user in Custom Integration settings.",
      },
    ],
  },
  tools: [
    {
      name: "productPlan.listRoadmaps",
      functionName: "productplan_roadmaps_list",
      aliases: ["productPlan.listRoadmaps", "productplan_roadmaps_list"],
      capability: "roadmap_read",
      platformCapability: "productplan_roadmap_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty fixed-field roadmap summaries.",
      inputSchema: {
        type: "object",
        properties: {
          nameContains: { type: "string", minLength: 1, maxLength: 80 },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "productPlan.getRoadmap",
      functionName: "productplan_roadmap_get",
      aliases: ["productPlan.getRoadmap", "productplan_roadmap_get"],
      capability: "roadmap_read",
      platformCapability: "productplan_roadmap_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact roadmap.",
      inputSchema: {
        type: "object",
        required: ["roadmapId"],
        properties: { roadmapId: numericId, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "productPlan.listBars",
      functionName: "productplan_bars_list",
      aliases: ["productPlan.listBars", "productplan_bars_list"],
      capability: "bar_read",
      platformCapability: "productplan_bar_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty fixed-field bars in one roadmap.",
      inputSchema: {
        type: "object",
        required: ["roadmapId"],
        properties: {
          roadmapId: numericId,
          nameContains: { type: "string", minLength: 1, maxLength: 80 },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "productPlan.getBar",
      functionName: "productplan_bar_get",
      aliases: ["productPlan.getBar", "productplan_bar_get"],
      capability: "bar_read",
      platformCapability: "productplan_bar_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact roadmap bar.",
      inputSchema: {
        type: "object",
        required: ["barId"],
        properties: { barId: numericId, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "productPlan.createParkedBar",
      functionName: "productplan_bar_create",
      aliases: ["productPlan.createParkedBar", "productplan_bar_create"],
      capability: "bar_write",
      platformCapability: "productplan_bar_write",
      action: "write",
      approvalRequired: true,
      description: "Create one parked bar with bounded metadata.",
      inputSchema: {
        type: "object",
        required: ["roadmapId", "name"],
        properties: {
          roadmapId: numericId,
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: { type: "string", maxLength: 4000 },
          percentDone: { type: "integer", minimum: 0, maximum: 100 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "productPlan.updateBar",
      functionName: "productplan_bar_update",
      aliases: ["productPlan.updateBar", "productplan_bar_update"],
      capability: "bar_write",
      platformCapability: "productplan_bar_write",
      action: "write",
      approvalRequired: true,
      description: "Update selected bounded metadata on one exact bar.",
      inputSchema: {
        type: "object",
        required: ["barId"],
        properties: {
          barId: numericId,
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: { type: ["string", "null"], maxLength: 4000 },
          percentDone: { type: ["integer", "null"], minimum: 0, maximum: 100 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "productPlan.deleteBar",
      functionName: "productplan_bar_delete",
      aliases: ["productPlan.deleteBar", "productplan_bar_delete"],
      capability: "bar_write",
      platformCapability: "productplan_bar_write",
      action: "write",
      approvalRequired: true,
      description: "Delete one exact bar after a fresh name confirmation.",
      inputSchema: {
        type: "object",
        required: ["barId", "expectedName"],
        properties: {
          barId: numericId,
          expectedName: { type: "string", minLength: 1, maxLength: 160 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "productplan_safe",
      label: "Safe",
      description:
        "Private roadmap reads and every mutation require approval. Fixed origin, token authority, bounds, name-confirmed deletion and audits always apply.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: allActions,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All seven selected ProductPlan actions run without Relay per-action approval; fixed origin, token authority, parked-only creation, deletion confirmation, bounds, redaction and audits still apply.",
      defaultSelected: false,
      allowedActions: allActions,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "productplan-token", label: "ProductPlan API token access" },
  ],
};
