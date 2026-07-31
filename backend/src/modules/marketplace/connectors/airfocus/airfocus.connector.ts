import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "airfocus_workspaces_list",
    "List workspaces",
    "List at most twenty bounded workspace summaries visible to the token user.",
  ),
  action(
    "airfocus_workspace_get",
    "Read workspace",
    "Read bounded metadata for one exact Airfocus workspace UUID.",
  ),
  action(
    "airfocus_items_list",
    "List workspace items",
    "List at most twenty metadata-only items from one exact workspace.",
  ),
  action(
    "airfocus_item_get",
    "Read item",
    "Read bounded metadata for one exact item in one exact workspace.",
  ),
];
const writes = [
  action(
    "airfocus_item_create",
    "Create item",
    "Create one minimal unarchived item with a bounded name.",
  ),
  action(
    "airfocus_item_update",
    "Update item",
    "Change only an exact item's bounded name or archived state after its current name matches.",
  ),
  action(
    "airfocus_item_delete",
    "Delete item",
    "Permanently delete one exact item only after its current name matches the supplied confirmation.",
  ),
];
const allActions = [...reads, ...writes];
const blockedActions = [
  blocked(
    "airfocus_workspace_admin",
    "Administer workspaces",
    "Workspace creation, settings, statuses, permissions, duplication, deletion and administrator elevation are unavailable.",
  ),
  blocked(
    "airfocus_item_advanced",
    "Change advanced item data",
    "Descriptions, custom fields, status, assignees, colors, ordering, integrations and arbitrary JSON Patch paths are unavailable.",
  ),
  blocked(
    "airfocus_collaboration",
    "Change collaboration data",
    "Comments, watchers, attachments, links, hierarchy relations and link types are unavailable.",
  ),
  blocked(
    "airfocus_team_profile",
    "Manage team or profile",
    "Members, groups, roles, profile, notification settings, AI actors and templates are unavailable.",
  ),
  blocked(
    "airfocus_raw_api",
    "Run arbitrary Airfocus calls",
    "Agents cannot choose API origins, paths, filters, request bodies, media types or raw REST operations.",
  ),
  blocked(
    "airfocus_bulk_global",
    "Run bulk or global operations",
    "Bulk, cross-workspace, alias, analytics, copy, move and global-search operations are unavailable.",
  ),
  blocked(
    "airfocus_unbounded",
    "Export Airfocus data",
    "Twenty-row lists, one exact resource and 256 KiB responses are the maximum supported surface.",
  ),
];
const uuid = { type: "string", format: "uuid" };
const limit = { type: "integer", minimum: 1, maximum: 20, default: 10 };
const approvalId = { type: "string", maxLength: 200 };

export const AIRFOCUS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "airfocus",
  name: "Airfocus",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.airfocus.com/",
  providerWebsiteUrl: "https://airfocus.com/",
  capabilities: [
    {
      ...capability(
        "workspace_read",
        "Read workspaces",
        "List bounded visible workspaces and inspect one exact workspace.",
        true,
      ),
      platformCapability: "airfocus_workspace_read",
    },
    {
      ...capability(
        "item_read",
        "Read workspace items",
        "List and inspect metadata-only items inside one exact workspace.",
        true,
      ),
      platformCapability: "airfocus_item_read",
    },
    {
      ...capability(
        "item_write",
        "Manage workspace items",
        "Create minimal items, collision-safely rename/archive them and name-confirm deletion.",
        false,
      ),
      platformCapability: "airfocus_item_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "AIRFOCUS_API_TOKEN",
        label: "Airfocus personal access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A dedicated Airfocus personal access token with workspace read/write scope, created by the intended least-authority user.",
      },
      {
        name: "AIRFOCUS_REGION",
        label: "Airfocus data region",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "The fixed Airfocus API region: eu or us.",
      },
    ],
  },
  tools: [
    {
      name: "airfocus.listWorkspaces",
      functionName: "airfocus_workspaces_list",
      aliases: ["airfocus.listWorkspaces", "airfocus_workspaces_list"],
      description: "List bounded active workspaces visible to the token user.",
      capability: "workspace_read",
      platformCapability: "airfocus_workspace_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          keyword: { type: "string", minLength: 1, maxLength: 80 },
          limit,
          approvalId,
        },
      },
    },
    {
      name: "airfocus.getWorkspace",
      functionName: "airfocus_workspace_get",
      aliases: ["airfocus.getWorkspace", "airfocus_workspace_get"],
      description: "Read bounded metadata for one exact workspace UUID.",
      capability: "workspace_read",
      platformCapability: "airfocus_workspace_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId"],
        properties: { workspaceId: uuid, approvalId },
      },
    },
    {
      name: "airfocus.listItems",
      functionName: "airfocus_items_list",
      aliases: ["airfocus.listItems", "airfocus_items_list"],
      description:
        "List bounded active item metadata from one exact workspace.",
      capability: "item_read",
      platformCapability: "airfocus_item_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId"],
        properties: {
          workspaceId: uuid,
          keyword: { type: "string", minLength: 1, maxLength: 80 },
          limit,
          approvalId,
        },
      },
    },
    {
      name: "airfocus.getItem",
      functionName: "airfocus_item_get",
      aliases: ["airfocus.getItem", "airfocus_item_get"],
      description:
        "Read bounded metadata for one exact item in one exact workspace.",
      capability: "item_read",
      platformCapability: "airfocus_item_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId", "itemId"],
        properties: { workspaceId: uuid, itemId: uuid, approvalId },
      },
    },
    {
      name: "airfocus.createItem",
      functionName: "airfocus_item_create",
      aliases: ["airfocus.createItem", "airfocus_item_create"],
      description: "Create one minimal unarchived item with a bounded name.",
      capability: "item_write",
      platformCapability: "airfocus_item_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId", "name"],
        properties: {
          workspaceId: uuid,
          name: { type: "string", minLength: 1, maxLength: 160 },
          approvalId,
        },
      },
    },
    {
      name: "airfocus.updateItem",
      functionName: "airfocus_item_update",
      aliases: ["airfocus.updateItem", "airfocus_item_update"],
      description:
        "Rename or archive one exact item after checking its current name.",
      capability: "item_write",
      platformCapability: "airfocus_item_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId", "itemId", "expectedName"],
        properties: {
          workspaceId: uuid,
          itemId: uuid,
          expectedName: { type: "string", minLength: 1, maxLength: 160 },
          name: { type: "string", minLength: 1, maxLength: 160 },
          archived: { type: "boolean" },
          approvalId,
        },
        anyOf: [{ required: ["name"] }, { required: ["archived"] }],
      },
    },
    {
      name: "airfocus.deleteItem",
      functionName: "airfocus_item_delete",
      aliases: ["airfocus.deleteItem", "airfocus_item_delete"],
      description: "Delete one exact item after checking its current name.",
      capability: "item_write",
      platformCapability: "airfocus_item_write",
      action: "write",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId", "itemId", "expectedName"],
        properties: {
          workspaceId: uuid,
          itemId: uuid,
          expectedName: { type: "string", minLength: 1, maxLength: 160 },
          approvalId,
        },
      },
    },
  ],
  approvalProfiles: [
    {
      id: "airfocus_safe",
      label: "Safe",
      description:
        "Private reads and every item mutation require approval. Fixed region, inherited user authority, exact UUIDs, bounds, confirmation and audits always apply.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: allActions,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All seven selected Airfocus actions run without Relay per-action approval; fixed region, token authority, bounds, field allowlists, confirmation, redaction and audits still apply.",
      defaultSelected: false,
      allowedActions: allActions,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "airfocus-token", label: "Airfocus personal access token" },
  ],
};
