import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDraft = [
  action(
    "slack_lists_items_list",
    "List items",
    "List one bounded page of shaped items from one explicit Slack List.",
  ),
  action(
    "slack_lists_item_draft",
    "Draft text item",
    "Prepare one bounded text item locally without a provider side effect.",
  ),
];
const writes = [
  action(
    "slack_lists_todo_create",
    "Create to-do List",
    "Create one basic standalone Slack List in to-do mode.",
  ),
  action(
    "slack_lists_text_item_create",
    "Add text item",
    "Add one bounded text value to one explicit column in one explicit List.",
  ),
];
const blockedActions = [
  blocked(
    "slack_lists_destructive",
    "Block destructive changes",
    "List and item deletion, bulk deletion, archival and arbitrary updates are not exposed.",
  ),
  blocked(
    "slack_lists_access",
    "Block access changes",
    "User and channel access grants, revocations and ownership changes are not exposed.",
  ),
  blocked(
    "slack_lists_sensitive_fields",
    "Block sensitive fields",
    "Email, phone, user, attachment, message, link, channel and reference fields are removed from responses and unavailable for writes.",
  ),
  blocked(
    "slack_lists_export",
    "Block downloads and exports",
    "Download jobs, bulk exports, automatic pagination and broad List discovery are not exposed.",
  ),
  blocked(
    "slack_lists_raw_api",
    "Block raw Slack access",
    "Arbitrary Slack methods, custom schemas, caller-selected origins and raw tokens are not exposed.",
  ),
];

export const SLACK_LISTS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "slack-lists",
  name: "Slack Lists",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.slack.dev/surfaces/lists/",
  providerWebsiteUrl: "https://slack.com/features/lists",
  capabilities: [
    {
      ...capability(
        "list_read",
        "Read bounded List items",
        "Inspect shaped items from one explicit Slack List.",
        true,
      ),
      platformCapability: "slack_lists_read",
    },
    {
      ...capability(
        "list_write",
        "Create Lists and text items",
        "Create a basic to-do List or add one bounded text item.",
        true,
      ),
      platformCapability: "slack_lists_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SLACK_LISTS_TOKEN",
        label: "Slack Lists app token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A bot or user token from the customer's own Slack app with lists:read and lists:write. Railway stores it encrypted and sends it only to slack.com/api.",
      },
    ],
  },
  tools: [
    {
      name: "slackLists.listItems",
      functionName: "slack_lists_items_list",
      aliases: ["slackLists.listItems", "slack_lists_items_list"],
      capability: "list_read",
      platformCapability: "slack_lists_read",
      action: "read",
      approvalRequired: false,
      description:
        "List one bounded page of shaped items from one explicit Slack List.",
      inputSchema: {
        type: "object",
        properties: {
          listId: { type: "string", pattern: "^F[A-Z0-9]{2,31}$" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["listId"],
        additionalProperties: false,
      },
    },
    {
      name: "slackLists.draftTextItem",
      functionName: "slack_lists_item_draft",
      aliases: ["slackLists.draftTextItem", "slack_lists_item_draft"],
      capability: "list_write",
      platformCapability: "slack_lists_write",
      action: "draft",
      approvalRequired: false,
      description: "Prepare one bounded List text item locally.",
      inputSchema: {
        type: "object",
        properties: {
          listId: { type: "string", pattern: "^F[A-Z0-9]{2,31}$" },
          columnId: { type: "string", pattern: "^Col[A-Z0-9]{2,31}$" },
          text: { type: "string", minLength: 1, maxLength: 2000 },
        },
        required: ["listId", "columnId", "text"],
        additionalProperties: false,
      },
    },
    {
      name: "slackLists.createTodoList",
      functionName: "slack_lists_todo_create",
      aliases: ["slackLists.createTodoList", "slack_lists_todo_create"],
      capability: "list_write",
      platformCapability: "slack_lists_write",
      action: "write",
      approvalRequired: true,
      description: "Create one basic standalone List in to-do mode.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          approvalId: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
    {
      name: "slackLists.createTextItem",
      functionName: "slack_lists_text_item_create",
      aliases: ["slackLists.createTextItem", "slack_lists_text_item_create"],
      capability: "list_write",
      platformCapability: "slack_lists_write",
      action: "write",
      approvalRequired: true,
      description: "Add one bounded text value to one explicit List column.",
      inputSchema: {
        type: "object",
        properties: {
          listId: { type: "string", pattern: "^F[A-Z0-9]{2,31}$" },
          columnId: { type: "string", pattern: "^Col[A-Z0-9]{2,31}$" },
          text: { type: "string", minLength: 1, maxLength: 2000 },
          approvalId: { type: "string" },
        },
        required: ["listId", "columnId", "text"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "slack_lists_safe",
      label: "Safe",
      description:
        "Bounded item reads and local drafts run directly; each List or item creation requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDraft,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected List and item creation runs without Relay per-action approval while fixed methods, shaping, bounds, audits, Slack scopes and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...readsAndDraft, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "workspace_auth",
      label: "Slack Lists workspace authorization",
      requiredScopes: ["lists:read", "lists:write"],
    },
  ],
};
