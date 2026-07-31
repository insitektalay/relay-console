import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const readsAndDrafts = [
  action(
    "asana_task_search",
    "Find tasks",
    "Find a bounded set of tasks in one explicit workspace.",
  ),
  action(
    "asana_project_list",
    "List projects",
    "List bounded projects in one explicit workspace.",
  ),
  action("asana_task_get", "Read a task", "Read one explicit task by GID."),
  action(
    "asana_task_prepare",
    "Prepare a task change",
    "Prepare and hash one task create or update locally.",
  ),
];
const writes = [
  action(
    "asana_task_create",
    "Create a task",
    "Create one task in an explicit workspace or project.",
  ),
  action(
    "asana_task_update",
    "Update a task",
    "Update bounded fields on one explicit task.",
  ),
];
const blockedActions = [
  blocked(
    "asana_admin",
    "Administer Asana",
    "Workspace, organization, user, team, OAuth-app, webhook, and billing administration are outside V1.",
  ),
  blocked(
    "asana_destructive",
    "Delete or bulk-change work",
    "Task deletion, project mutation, broad exports, and bulk changes are outside V1.",
  ),
  blocked(
    "asana_raw_api",
    "Call arbitrary Asana endpoints",
    "Raw paths, unbounded pagination, and arbitrary REST requests are never exposed.",
  ),
];

export const ASANA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "asana",
  name: "Asana",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.asana.com/docs",
  providerWebsiteUrl: "https://asana.com/",
  capabilities: [
    {
      ...capability(
        "task_read",
        "Find and read tasks",
        "Find bounded tasks and read one explicit task.",
        true,
      ),
      platformCapability: "asana_task_read",
    },
    {
      ...capability(
        "project_read",
        "View projects",
        "List bounded projects in an explicit workspace.",
        true,
      ),
      platformCapability: "asana_project_read",
    },
    {
      ...capability(
        "task_draft",
        "Prepare task changes",
        "Prepare an exact task create or update locally.",
        true,
      ),
      platformCapability: "asana_task_draft",
    },
    {
      ...capability(
        "task_write",
        "Create and update tasks",
        "Create one task or update bounded fields on one explicit task.",
        true,
      ),
      platformCapability: "asana_task_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.asana.com/-/oauth_authorize",
      tokenUrl: "https://app.asana.com/-/oauth_token",
      refreshUrl: "https://app.asana.com/-/oauth_token",
      revocationUrl: "https://app.asana.com/-/oauth_revoke",
      userInfoUrl: "https://app.asana.com/api/1.0/users/me",
      requiredScopes: [
        "users:read",
        "workspaces:read",
        "projects:read",
        "tasks:read",
        "tasks:write",
      ],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ASANA_CLIENT_ID",
        label: "Asana OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Asana OAuth application ID.",
      },
      {
        name: "ASANA_CLIENT_SECRET",
        label: "Asana OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Asana client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "relay_asana_search_tasks",
      functionName: "relay_asana_search_tasks",
      aliases: ["asana_task_search"],
      capability: "task_read",
      platformCapability: "asana_task_read",
      action: "read",
      approvalRequired: false,
      description: "Find at most twenty-five tasks in one Asana workspace.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceGid: { type: "string", minLength: 1, maxLength: 100 },
          query: { type: "string", maxLength: 200 },
          projectGid: { type: "string", maxLength: 100 },
          completed: { type: "boolean" },
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["workspaceGid"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_asana_list_projects",
      functionName: "relay_asana_list_projects",
      aliases: ["asana_project_list"],
      capability: "project_read",
      platformCapability: "asana_project_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five projects in one Asana workspace.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceGid: { type: "string", minLength: 1, maxLength: 100 },
          maxResults: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["workspaceGid"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_asana_get_task",
      functionName: "relay_asana_get_task",
      aliases: ["asana_task_get"],
      capability: "task_read",
      platformCapability: "asana_task_read",
      action: "read",
      approvalRequired: false,
      description: "Read one explicit Asana task by GID.",
      inputSchema: {
        type: "object",
        properties: {
          taskGid: { type: "string", minLength: 1, maxLength: 100 },
          maxNotesChars: { type: "integer", minimum: 1, maximum: 4000 },
        },
        required: ["taskGid"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_asana_draft_task_change",
      functionName: "relay_asana_draft_task_change",
      aliases: ["asana_task_prepare"],
      capability: "task_draft",
      platformCapability: "asana_task_draft",
      action: "draft",
      approvalRequired: false,
      description: "Prepare one bounded task create or update locally.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["create", "update"] },
          taskGid: { type: "string", maxLength: 100 },
          fields: { type: "object" },
        },
        required: ["operation", "fields"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_asana_create_task",
      functionName: "relay_asana_create_task",
      aliases: ["asana_task_create"],
      capability: "task_write",
      platformCapability: "asana_task_write",
      action: "write",
      approvalRequired: true,
      description: "Create one task in an explicit Asana workspace or project.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceGid: { type: "string", maxLength: 100 },
          projectGid: { type: "string", maxLength: 100 },
          name: { type: "string", minLength: 1, maxLength: 512 },
          notes: { type: "string", maxLength: 16000 },
          assigneeGid: { type: "string", maxLength: 100 },
          dueOn: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          completed: { type: "boolean" },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["name", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_asana_update_task",
      functionName: "relay_asana_update_task",
      aliases: ["asana_task_update"],
      capability: "task_write",
      platformCapability: "asana_task_write",
      action: "write",
      approvalRequired: true,
      description: "Update bounded fields on one explicit Asana task.",
      inputSchema: {
        type: "object",
        properties: {
          taskGid: { type: "string", minLength: 1, maxLength: 100 },
          name: { type: "string", minLength: 1, maxLength: 512 },
          notes: { type: "string", maxLength: 16000 },
          assigneeGid: { type: "string", maxLength: 100 },
          dueOn: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          completed: { type: "boolean" },
          idempotencyKey: { type: "string", minLength: 8, maxLength: 128 },
          approvalId: { type: "string" },
        },
        required: ["taskGid", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "asana_safe",
      label: "Safe",
      description:
        "Bounded reads and local drafts run directly; each Asana task write requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDrafts,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected supported Asana operation runs without Relay per-action approval; provider-granted access and safety bounds still apply.",
      defaultSelected: false,
      allowedActions: [...readsAndDrafts, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "asana_me",
      label: "Asana user and workspace authorization",
      requiredScopes: ["users:read", "workspaces:read"],
    },
  ],
};
