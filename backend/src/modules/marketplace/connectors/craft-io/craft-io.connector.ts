import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "craft_io_workspaces_list",
    "List workspaces",
    "List at most twenty bounded workspace summaries for the configured account.",
  ),
  action(
    "craft_io_items_list",
    "List workspace items",
    "List at most twenty metadata-only work items from one exact workspace.",
  ),
  action(
    "craft_io_item_get",
    "Read work item",
    "Read bounded metadata for one exact Craft.io work-item ID.",
  ),
  action(
    "craft_io_feedback_portals_list",
    "List feedback portals",
    "List at most twenty bounded feedback portals for the configured account.",
  ),
  action(
    "craft_io_feedback_categories_list",
    "List feedback categories",
    "List at most twenty categories from one exact feedback portal.",
  ),
  action(
    "craft_io_feedback_items_list",
    "List feedback items",
    "List at most twenty metadata-only feedback items from one exact portal.",
  ),
  action(
    "craft_io_feedback_item_get",
    "Read feedback item",
    "Read bounded metadata for one exact Craft.io feedback-item ID.",
  ),
];
const writes = [
  action(
    "craft_io_feedback_submit",
    "Submit plain feedback",
    "Submit one bounded plain feedback item to one exact portal and workspace.",
  ),
];
const allActions = [...reads, ...writes];
const blockedActions = [
  blocked(
    "craft_io_item_write",
    "Change work items",
    "Item creation, update, deletion, comments, dependencies and bulk item operations are unavailable.",
  ),
  blocked(
    "craft_io_portfolios",
    "Use portfolios",
    "Portfolio discovery, fields, terminology, items and portfolio-item mutation are outside this workspace-bound connection.",
  ),
  blocked(
    "craft_io_feedback_advanced",
    "Change advanced feedback",
    "Rich forms, custom fields, importance changes, companies, labels, comments, connections, promotion and bulk feedback operations are unavailable.",
  ),
  blocked(
    "craft_io_raw_mcp",
    "Mount Craft.io MCP tools",
    "Relay does not expose the provider's raw remote MCP tools or permit model-selected method discovery.",
  ),
  blocked(
    "craft_io_raw_api",
    "Run arbitrary Craft.io calls",
    "Agents cannot choose API origins, paths, fields, filters, pagination, request bodies or raw operations.",
  ),
  blocked(
    "craft_io_unbounded",
    "Export Craft.io data",
    "Twenty-row lists, one exact resource and 256 KiB responses are the maximum supported surface.",
  ),
];
const exactId = {
  type: "string",
  minLength: 1,
  maxLength: 100,
  pattern: "^[A-Za-z0-9_-]+$",
};
const approvalId = { type: "string", maxLength: 200 };

export const CRAFT_IO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "craft-io",
  name: "Craft.io",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.craft.io/docs/",
  providerWebsiteUrl: "https://craft.io/",
  capabilities: [
    {
      ...capability(
        "workspace_read",
        "Read workspaces",
        "List bounded workspaces in the configured Craft.io account.",
        true,
      ),
      platformCapability: "craft_io_workspace_read",
    },
    {
      ...capability(
        "item_read",
        "Read work items",
        "List bounded metadata-only workspace items and inspect one exact item.",
        true,
      ),
      platformCapability: "craft_io_item_read",
    },
    {
      ...capability(
        "feedback_read",
        "Read feedback",
        "List bounded portals, categories and feedback metadata and inspect one exact feedback item.",
        true,
      ),
      platformCapability: "craft_io_feedback_read",
    },
    {
      ...capability(
        "feedback_submit",
        "Submit plain feedback",
        "Submit one bounded plain feedback item without rich forms or custom fields.",
        false,
      ),
      platformCapability: "craft_io_feedback_submit",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CRAFT_IO_API_KEY",
        label: "Craft.io account API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "An Enterprise Craft.io account API key issued and scoped by Craft.io Customer Success.",
      },
      {
        name: "CRAFT_IO_ACCOUNT_ID",
        label: "Craft.io account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The exact account ID associated with the API key and permitted workspaces and portals.",
      },
      {
        name: "CRAFT_IO_REGION",
        label: "Craft.io data region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter us or eu to pin Railway to the documented regional Craft.io API origin.",
      },
    ],
  },
  tools: [
    {
      name: "craftIo.listWorkspaces",
      functionName: "craft_io_workspaces_list",
      aliases: ["craftIo.listWorkspaces", "craft_io_workspaces_list"],
      capability: "workspace_read",
      platformCapability: "craft_io_workspace_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty fixed-field account workspaces.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "craftIo.listItems",
      functionName: "craft_io_items_list",
      aliases: ["craftIo.listItems", "craft_io_items_list"],
      capability: "item_read",
      platformCapability: "craft_io_item_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty metadata-only work items.",
      inputSchema: {
        type: "object",
        required: ["workspaceId"],
        properties: {
          workspaceId: exactId,
          keyword: { type: "string", minLength: 2, maxLength: 80 },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "craftIo.getItem",
      functionName: "craft_io_item_get",
      aliases: ["craftIo.getItem", "craft_io_item_get"],
      capability: "item_read",
      platformCapability: "craft_io_item_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact work item's bounded metadata.",
      inputSchema: {
        type: "object",
        required: ["itemId"],
        properties: { itemId: exactId, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "craftIo.listFeedbackPortals",
      functionName: "craft_io_feedback_portals_list",
      aliases: [
        "craftIo.listFeedbackPortals",
        "craft_io_feedback_portals_list",
      ],
      capability: "feedback_read",
      platformCapability: "craft_io_feedback_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty fixed-field feedback portals.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "craftIo.listFeedbackCategories",
      functionName: "craft_io_feedback_categories_list",
      aliases: [
        "craftIo.listFeedbackCategories",
        "craft_io_feedback_categories_list",
      ],
      capability: "feedback_read",
      platformCapability: "craft_io_feedback_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty categories in one exact portal.",
      inputSchema: {
        type: "object",
        required: ["portalId"],
        properties: {
          portalId: exactId,
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "craftIo.listFeedbackItems",
      functionName: "craft_io_feedback_items_list",
      aliases: ["craftIo.listFeedbackItems", "craft_io_feedback_items_list"],
      capability: "feedback_read",
      platformCapability: "craft_io_feedback_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty metadata-only feedback items.",
      inputSchema: {
        type: "object",
        required: ["portalId"],
        properties: {
          portalId: exactId,
          keyword: { type: "string", minLength: 2, maxLength: 80 },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "craftIo.getFeedbackItem",
      functionName: "craft_io_feedback_item_get",
      aliases: ["craftIo.getFeedbackItem", "craft_io_feedback_item_get"],
      capability: "feedback_read",
      platformCapability: "craft_io_feedback_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact feedback item's bounded metadata.",
      inputSchema: {
        type: "object",
        required: ["feedbackItemId"],
        properties: { feedbackItemId: exactId, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "craftIo.submitPlainFeedback",
      functionName: "craft_io_feedback_submit",
      aliases: ["craftIo.submitPlainFeedback", "craft_io_feedback_submit"],
      capability: "feedback_submit",
      platformCapability: "craft_io_feedback_submit",
      action: "write",
      approvalRequired: true,
      description: "Submit one bounded plain feedback item.",
      inputSchema: {
        type: "object",
        required: [
          "portalId",
          "workspaceId",
          "categoryId",
          "title",
          "description",
          "submitterEmail",
        ],
        properties: {
          portalId: exactId,
          workspaceId: exactId,
          categoryId: exactId,
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", minLength: 1, maxLength: 4000 },
          submitterEmail: {
            type: "string",
            format: "email",
            maxLength: 254,
          },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "craft_io_safe",
      label: "Safe",
      description:
        "Private metadata reads and feedback submission require approval. Fixed region, account-key authority, bounds, redaction and audits always apply.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: allActions,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All eight selected Craft.io actions run without Relay per-action approval; fixed region, account-key authority, payload allowlists, bounds, redaction and audits still apply.",
      defaultSelected: false,
      allowedActions: allActions,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "craft-io-key", label: "Craft.io account API key access" },
  ],
};
