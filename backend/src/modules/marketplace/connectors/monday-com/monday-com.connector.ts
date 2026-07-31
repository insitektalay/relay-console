import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDrafts = [
  action(
    "monday_board_list",
    "List boards",
    "List a bounded set of boards visible to the connected monday.com user.",
  ),
  action(
    "monday_board_items",
    "List board items",
    "List a bounded first page of items from one explicit board.",
  ),
  action(
    "monday_item_get",
    "Read an item",
    "Read one explicit item with its board, group, columns, and bounded update context.",
  ),
  action(
    "monday_item_updates",
    "List item updates",
    "List bounded discussion updates for one explicit item.",
  ),
  action(
    "monday_item_prepare",
    "Prepare an item change",
    "Prepare and hash one item create, update, or comment locally.",
  ),
];
const writes = [
  action(
    "monday_item_create",
    "Create an item",
    "Create one item on an explicit board.",
  ),
  action(
    "monday_item_update",
    "Update an item",
    "Change the name or bounded column values of one explicit item.",
  ),
  action(
    "monday_item_comment_create",
    "Add an update",
    "Post one bounded discussion update to an explicit item.",
  ),
];
const blockedActions = [
  blocked(
    "monday_structure_admin",
    "Administer monday.com",
    "Workspace, board, group, column, user, team, permission, and billing administration are outside V1.",
  ),
  blocked(
    "monday_destructive",
    "Delete or bulk-change work",
    "Item deletion, file mutation, webhooks, schema mutation, broad exports, and bulk changes are outside V1.",
  ),
  blocked(
    "monday_raw_graphql",
    "Call arbitrary GraphQL",
    "Raw GraphQL, automatic pagination, and monday platform MCP tools are never exposed to agents.",
  ),
];

export const MONDAY_COM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "monday-com",
  name: "Monday.com",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.monday.com/",
  providerWebsiteUrl: "https://monday.com/",
  capabilities: [
    {
      ...capability(
        "board_read",
        "View boards",
        "List boards visible to the connected user.",
        true,
      ),
      platformCapability: "monday_board_read",
    },
    {
      ...capability(
        "item_read",
        "Find and read items",
        "List board items and read item details and updates.",
        true,
      ),
      platformCapability: "monday_item_read",
    },
    {
      ...capability(
        "item_draft",
        "Prepare item changes",
        "Prepare exact item creates, updates, or comments locally.",
        true,
      ),
      platformCapability: "monday_item_draft",
    },
    {
      ...capability(
        "item_write",
        "Create and update items",
        "Create items, update names or column values, and add discussion updates.",
        true,
      ),
      platformCapability: "monday_item_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.monday.com/oauth2/authorize",
      tokenUrl: "https://auth.monday.com/oauth_ms/oauth/token",
      refreshUrl: "https://auth.monday.com/oauth_ms/oauth/token",
      revocationUrl: "https://auth.monday.com/oauth_ms/oauth/revoke",
      requiredScopes: [
        "me:read",
        "account:read",
        "workspaces:read",
        "boards:read",
        "boards:write",
        "updates:read",
        "updates:write",
      ],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "MONDAY_CLIENT_ID",
        label: "Monday.com OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console monday.com application ID.",
      },
      {
        name: "MONDAY_CLIENT_SECRET",
        label: "Monday.com OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held monday.com client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_monday_list_boards",
      functionName: "relay_monday_list_boards",
      aliases: ["monday_board_list"],
      capability: "board_read",
      platformCapability: "monday_board_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five visible monday.com boards.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string", maxLength: 100 },
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "relay_monday_list_board_items",
      functionName: "relay_monday_list_board_items",
      aliases: ["monday_board_items"],
      capability: "item_read",
      platformCapability: "monday_item_read",
      action: "read",
      approvalRequired: false,
      description: "List at most fifty items from the first page of one board.",
      inputSchema: {
        type: "object",
        properties: {
          boardId: { type: "string", minLength: 1, maxLength: 100 },
          query: { type: "string", maxLength: 200 },
          maxResults: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["boardId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_monday_get_item",
      functionName: "relay_monday_get_item",
      aliases: ["monday_item_get"],
      capability: "item_read",
      platformCapability: "monday_item_read",
      action: "read",
      approvalRequired: false,
      description: "Read one explicit accessible item and bounded context.",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string", minLength: 1, maxLength: 100 },
          maxUpdateChars: { type: "integer", minimum: 1, maximum: 4000 },
        },
        required: ["itemId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_monday_list_item_updates",
      functionName: "relay_monday_list_item_updates",
      aliases: ["monday_item_updates"],
      capability: "item_read",
      platformCapability: "monday_item_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five updates for one explicit item.",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string", minLength: 1, maxLength: 100 },
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
          maxBodyChars: { type: "integer", minimum: 1, maximum: 4000 },
        },
        required: ["itemId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_monday_draft_item_change",
      functionName: "relay_monday_draft_item_change",
      aliases: ["monday_item_prepare"],
      capability: "item_draft",
      platformCapability: "monday_item_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Prepare one bounded item create, update, or comment locally.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["create", "update", "comment"] },
          itemId: { type: "string", maxLength: 100 },
          fields: { type: "object" },
        },
        required: ["operation", "fields"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_monday_create_item",
      functionName: "relay_monday_create_item",
      aliases: ["monday_item_create"],
      capability: "item_write",
      platformCapability: "monday_item_write",
      action: "write",
      approvalRequired: true,
      description: "Create one exact item on an explicit board.",
      inputSchema: {
        type: "object",
        properties: {
          boardId: { type: "string", minLength: 1, maxLength: 100 },
          groupId: { type: "string", maxLength: 100 },
          name: { type: "string", minLength: 1, maxLength: 512 },
          columnValues: { type: "object" },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["boardId", "name", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_monday_update_item",
      functionName: "relay_monday_update_item",
      aliases: ["monday_item_update"],
      capability: "item_write",
      platformCapability: "monday_item_write",
      action: "write",
      approvalRequired: true,
      description: "Update the name or bounded column values of one item.",
      inputSchema: {
        type: "object",
        properties: {
          boardId: { type: "string", minLength: 1, maxLength: 100 },
          itemId: { type: "string", minLength: 1, maxLength: 100 },
          name: { type: "string", minLength: 1, maxLength: 512 },
          columnValues: { type: "object" },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["boardId", "itemId", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_monday_add_update",
      functionName: "relay_monday_add_update",
      aliases: ["monday_item_comment_create"],
      capability: "item_write",
      platformCapability: "monday_item_write",
      action: "write",
      approvalRequired: true,
      description: "Post one bounded discussion update to an explicit item.",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string", minLength: 1, maxLength: 100 },
          body: { type: "string", minLength: 1, maxLength: 8000 },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["itemId", "body", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "monday_safe",
      label: "Safe",
      description:
        "Bounded reads and local drafts run directly; each monday.com item write requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDrafts,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected monday.com operation supported by this connector runs without Relay per-action approval; connection ownership, request bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDrafts, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "monday_user_account",
      label: "Monday.com user and account",
      requiredScopes: ["me:read", "account:read"],
    },
  ],
};
