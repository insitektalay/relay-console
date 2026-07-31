import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "liquidplanner_workspaces_list",
    "List workspaces",
    "List at most twenty workspaces available to the token owner.",
  ),
  action(
    "liquidplanner_items_list",
    "List plan items",
    "List at most twenty metadata-only plan items in one exact workspace.",
  ),
  action(
    "liquidplanner_item_get",
    "Read plan item",
    "Read bounded metadata for one exact plan item.",
  ),
];
const writes = [
  action(
    "liquidplanner_task_create",
    "Create task",
    "Create one minimal task under one exact parent item.",
  ),
  action(
    "liquidplanner_item_rename",
    "Rename plan item",
    "Rename one exact plan item after its current name matches.",
  ),
];
const allActions = [...reads, ...writes];
const blockedActions = [
  blocked(
    "liquidplanner_org_workspace_admin",
    "Administer organizations or workspaces",
    "Organizations, workspaces, members, resources, placeholders, roles, tokens, billing and settings are unavailable.",
  ),
  blocked(
    "liquidplanner_item_advanced",
    "Change advanced plan data",
    "Descriptions, dates, estimates, priorities, status, custom fields, assignments, dependencies and item movement are unavailable.",
  ),
  blocked(
    "liquidplanner_people_financials",
    "Access people or financial data",
    "Members, assignments, time entries, timesheet notes, cost codes, billing rates and pay rates are unavailable.",
  ),
  blocked(
    "liquidplanner_files_exports",
    "Access files or exports",
    "Files, attachments, timesheet exports and grid downloads are unavailable.",
  ),
  blocked(
    "liquidplanner_classic_api",
    "Use LiquidPlanner Classic",
    "The legacy app.liquidplanner.com API and Classic credentials are outside this connection.",
  ),
  blocked(
    "liquidplanner_raw_api",
    "Run arbitrary LiquidPlanner calls",
    "Agents cannot choose origins, paths, raw filters, continuation tokens, fields or request bodies.",
  ),
  blocked(
    "liquidplanner_bulk_unbounded",
    "Run bulk or unbounded operations",
    "Bulk mutation, recursive tree walks, duplication, deletion, exports and responses above twenty rows or 256 KiB are unavailable.",
  ),
];
const id = {
  type: "string",
  pattern: "^[0-9]{1,20}$",
  minLength: 1,
  maxLength: 20,
};
const limit = { type: "integer", minimum: 1, maximum: 20, default: 10 };
const approvalId = { type: "string", maxLength: 200 };

export const LIQUIDPLANNER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "liquidplanner",
  name: "LiquidPlanner",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api-docs.liquidplanner.com/docs/getting-started-notes-from-readme",
  providerWebsiteUrl: "https://www.liquidplanner.com/",
  capabilities: [
    {
      ...capability(
        "workspace_read",
        "Read workspaces",
        "List bounded workspaces available to the token owner.",
        true,
      ),
      platformCapability: "liquidplanner_workspace_read",
    },
    {
      ...capability(
        "item_read",
        "Read plan items",
        "List and inspect bounded plan-item metadata without descriptions, people or estimates.",
        true,
      ),
      platformCapability: "liquidplanner_item_read",
    },
    {
      ...capability(
        "item_write",
        "Manage plan items",
        "Create minimal tasks and name-check plan-item renames.",
        false,
      ),
      platformCapability: "liquidplanner_item_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LIQUIDPLANNER_API_TOKEN",
        label: "LiquidPlanner API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A separate bearer token owned by a dedicated least-authority LiquidPlanner New member and rotated regularly.",
      },
    ],
  },
  tools: [
    {
      name: "liquidplanner.listWorkspaces",
      functionName: "liquidplanner_workspaces_list",
      aliases: ["liquidplanner.listWorkspaces", "liquidplanner_workspaces_list"],
      description: "List bounded workspaces available to the token owner.",
      capability: "workspace_read",
      platformCapability: "liquidplanner_workspace_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { limit, approvalId },
      },
    },
    {
      name: "liquidplanner.listItems",
      functionName: "liquidplanner_items_list",
      aliases: ["liquidplanner.listItems", "liquidplanner_items_list"],
      description: "List bounded metadata-only plan items in one workspace.",
      capability: "item_read",
      platformCapability: "liquidplanner_item_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId", "itemType"],
        properties: {
          workspaceId: id,
          parentId: id,
          itemType: {
            type: "string",
            enum: ["packages", "projects", "folders", "tasks"],
          },
          limit,
          approvalId,
        },
      },
    },
    {
      name: "liquidplanner.getItem",
      functionName: "liquidplanner_item_get",
      aliases: ["liquidplanner.getItem", "liquidplanner_item_get"],
      description: "Read bounded metadata for one exact plan item.",
      capability: "item_read",
      platformCapability: "liquidplanner_item_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId", "itemId"],
        properties: { workspaceId: id, itemId: id, approvalId },
      },
    },
    {
      name: "liquidplanner.createTask",
      functionName: "liquidplanner_task_create",
      aliases: ["liquidplanner.createTask", "liquidplanner_task_create"],
      description: "Create one minimal task under one exact parent item.",
      capability: "item_write",
      platformCapability: "liquidplanner_item_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId", "parentId", "name"],
        properties: {
          workspaceId: id,
          parentId: id,
          name: { type: "string", minLength: 1, maxLength: 200 },
          approvalId,
        },
      },
    },
    {
      name: "liquidplanner.renameItem",
      functionName: "liquidplanner_item_rename",
      aliases: ["liquidplanner.renameItem", "liquidplanner_item_rename"],
      description: "Rename one exact plan item after its current name matches.",
      capability: "item_write",
      platformCapability: "liquidplanner_item_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId", "itemId", "expectedName", "name"],
        properties: {
          workspaceId: id,
          itemId: id,
          expectedName: { type: "string", minLength: 1, maxLength: 200 },
          name: { type: "string", minLength: 1, maxLength: 200 },
          approvalId,
        },
      },
    },
  ],
  approvalProfiles: [
    {
      id: "liquidplanner_safe",
      label: "Safe",
      description:
        "Private reads and both mutations require approval. Fixed origin, token-owner authority, bounds, field allowlists, name checks, redaction and audits always apply.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: allActions,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All five selected actions run without Relay per-action approval; fixed origin, token authority, bounds, field allowlists, name checks, redaction and audits still apply.",
      defaultSelected: false,
      allowedActions: allActions,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "workspaces",
      label: "API token and visible-workspace validation",
    },
  ],
};
