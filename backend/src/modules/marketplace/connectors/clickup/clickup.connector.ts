import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDrafts = [
  action(
    "clickup_workspace_list",
    "List Workspaces",
    "List the Workspaces selected during ClickUp authorization.",
  ),
  action(
    "clickup_workspace_task_search",
    "Find Workspace tasks",
    "Find a bounded set of accessible tasks in one authorized Workspace.",
  ),
  action(
    "clickup_list_tasks",
    "List tasks",
    "List a bounded set of tasks whose home is one explicit ClickUp List.",
  ),
  action(
    "clickup_task_get",
    "Read a task",
    "Read one explicit accessible ClickUp task.",
  ),
  action(
    "clickup_task_prepare",
    "Prepare a task change",
    "Prepare and hash one task create, update, or comment locally.",
  ),
];
const writes = [
  action(
    "clickup_task_create",
    "Create a task",
    "Create one task in an explicit ClickUp List.",
  ),
  action(
    "clickup_task_update",
    "Update a task",
    "Update bounded fields on one explicit ClickUp task.",
  ),
  action(
    "clickup_task_comment_create",
    "Add a comment",
    "Add one bounded comment to one explicit ClickUp task.",
  ),
];
const blockedActions = [
  blocked(
    "clickup_admin",
    "Administer ClickUp",
    "Workspace, member, guest, Space, Folder, List, OAuth-app, webhook, and billing administration are outside V1.",
  ),
  blocked(
    "clickup_destructive",
    "Delete or bulk-change work",
    "Task deletion, custom-field and dependency mutation, time tracking, broad exports, and bulk changes are outside V1.",
  ),
  blocked(
    "clickup_raw_api",
    "Call arbitrary ClickUp endpoints",
    "Raw paths, automatic pagination, arbitrary REST requests, and the beta MCP surface are never exposed.",
  ),
];

export const CLICKUP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "clickup",
  name: "ClickUp",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.clickup.com/",
  providerWebsiteUrl: "https://clickup.com/",
  capabilities: [
    {
      ...capability(
        "workspace_read",
        "View Workspaces",
        "List the Workspaces selected during authorization.",
        true,
      ),
      platformCapability: "clickup_workspace_read",
    },
    {
      ...capability(
        "task_read",
        "Find and read tasks",
        "Find bounded Workspace tasks, list tasks in one List, and read one explicit task.",
        true,
      ),
      platformCapability: "clickup_task_read",
    },
    {
      ...capability(
        "task_draft",
        "Prepare task changes",
        "Prepare an exact task create, update, or comment locally.",
        true,
      ),
      platformCapability: "clickup_task_draft",
    },
    {
      ...capability(
        "task_write",
        "Create and update tasks",
        "Create tasks, update bounded task fields, and add comments.",
        true,
      ),
      platformCapability: "clickup_task_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.clickup.com/api",
      tokenUrl: "https://api.clickup.com/api/v2/oauth/token",
      userInfoUrl: "https://api.clickup.com/api/v2/user",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "CLICKUP_CLIENT_ID",
        label: "ClickUp OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console ClickUp OAuth application ID.",
      },
      {
        name: "CLICKUP_CLIENT_SECRET",
        label: "ClickUp OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held ClickUp client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_clickup_list_workspaces",
      functionName: "relay_clickup_list_workspaces",
      aliases: ["clickup_workspace_list"],
      capability: "workspace_read",
      platformCapability: "clickup_workspace_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five ClickUp Workspaces selected during authorization.",
      inputSchema: {
        type: "object",
        properties: {
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "relay_clickup_search_workspace_tasks",
      functionName: "relay_clickup_search_workspace_tasks",
      aliases: ["clickup_workspace_task_search"],
      capability: "task_read",
      platformCapability: "clickup_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "Find at most fifty accessible tasks from the first bounded ClickUp Workspace page.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string", minLength: 1, maxLength: 100 },
          query: { type: "string", maxLength: 200 },
          maxResults: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["workspaceId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_clickup_list_tasks",
      functionName: "relay_clickup_list_tasks",
      aliases: ["clickup_list_tasks"],
      capability: "task_read",
      platformCapability: "clickup_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most fifty tasks whose home is one explicit ClickUp List.",
      inputSchema: {
        type: "object",
        properties: {
          listId: { type: "string", minLength: 1, maxLength: 100 },
          maxResults: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["listId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_clickup_get_task",
      functionName: "relay_clickup_get_task",
      aliases: ["clickup_task_get"],
      capability: "task_read",
      platformCapability: "clickup_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one explicit accessible ClickUp task with a bounded description.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string", minLength: 1, maxLength: 100 },
          maxDescriptionChars: { type: "integer", minimum: 1, maximum: 4000 },
        },
        required: ["taskId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_clickup_draft_task_change",
      functionName: "relay_clickup_draft_task_change",
      aliases: ["clickup_task_prepare"],
      capability: "task_draft",
      platformCapability: "clickup_task_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Prepare one bounded ClickUp task create, update, or comment locally.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["create", "update", "comment"] },
          taskId: { type: "string", maxLength: 100 },
          fields: { type: "object" },
        },
        required: ["operation", "fields"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_clickup_create_task",
      functionName: "relay_clickup_create_task",
      aliases: ["clickup_task_create"],
      capability: "task_write",
      platformCapability: "clickup_task_write",
      action: "write",
      approvalRequired: true,
      description: "Create one exact task in an explicit ClickUp List.",
      inputSchema: {
        type: "object",
        properties: {
          listId: { type: "string", minLength: 1, maxLength: 100 },
          name: { type: "string", minLength: 1, maxLength: 512 },
          description: { type: "string", maxLength: 16000 },
          status: { type: "string", maxLength: 100 },
          priority: { type: "integer", minimum: 1, maximum: 4 },
          assigneeIds: {
            type: "array",
            items: { type: "integer" },
            maxItems: 25,
          },
          dueDate: { type: "integer", minimum: 0 },
          startDate: { type: "integer", minimum: 0 },
          parentTaskId: { type: "string", maxLength: 100 },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["listId", "name", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_clickup_update_task",
      functionName: "relay_clickup_update_task",
      aliases: ["clickup_task_update"],
      capability: "task_write",
      platformCapability: "clickup_task_write",
      action: "write",
      approvalRequired: true,
      description: "Update bounded fields on one explicit ClickUp task.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string", minLength: 1, maxLength: 100 },
          name: { type: "string", minLength: 1, maxLength: 512 },
          description: { type: "string", maxLength: 16000 },
          status: { type: "string", maxLength: 100 },
          priority: { type: "integer", minimum: 1, maximum: 4 },
          addAssigneeIds: {
            type: "array",
            items: { type: "integer" },
            maxItems: 25,
          },
          removeAssigneeIds: {
            type: "array",
            items: { type: "integer" },
            maxItems: 25,
          },
          dueDate: { type: "integer", minimum: 0 },
          startDate: { type: "integer", minimum: 0 },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["taskId", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_clickup_add_comment",
      functionName: "relay_clickup_add_comment",
      aliases: ["clickup_task_comment_create"],
      capability: "task_write",
      platformCapability: "clickup_task_write",
      action: "write",
      approvalRequired: true,
      description: "Add one bounded comment to one explicit ClickUp task.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string", minLength: 1, maxLength: 100 },
          comment: { type: "string", minLength: 1, maxLength: 8000 },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["taskId", "comment", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "clickup_safe",
      label: "Safe",
      description:
        "Bounded reads and local drafts run directly; each ClickUp task write requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDrafts,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected ClickUp operation supported by this connector runs without Relay per-action approval; connection ownership, Workspace selection, request bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDrafts, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "clickup_user_workspaces",
      label: "ClickUp user and authorized Workspaces",
    },
  ],
};
