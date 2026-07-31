import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_TASKS_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/tasks",
];
const reads = [
  action(
    "google_tasks_tasklists_list",
    "List task lists",
    "Return at most twenty TaskList summaries from the first page.",
  ),
  action(
    "google_tasks_tasks_list",
    "List tasks",
    "Return at most one hundred non-deleted tasks from one explicit TaskList.",
  ),
  action(
    "google_tasks_update_prepare",
    "Prepare task update",
    "Validate and hash one task creation or safe patch locally.",
  ),
];
const writes = [
  action(
    "google_tasks_task_create",
    "Create task",
    "Create one top-level Task with bounded fields.",
  ),
  action(
    "google_tasks_task_patch",
    "Patch task",
    "Safely patch allowlisted fields after assigned-task and ETag checks.",
  ),
];
const blockedActions = [
  blocked(
    "google_tasks_delete_clear",
    "Delete or clear tasks",
    "Task and TaskList deletion and completed-task clearing are blocked in V1.",
  ),
  blocked(
    "google_tasks_move_parent",
    "Move or reparent tasks",
    "Move, reorder, indent, parent, and sibling-position changes are blocked in V1.",
  ),
  blocked(
    "google_tasks_tasklist_admin",
    "Administer task lists",
    "Creating, updating, renaming, and deleting TaskLists is blocked in V1.",
  ),
  blocked(
    "google_tasks_assigned_context",
    "Mutate assigned tasks or expose assignment context",
    "Docs or Chat assigned tasks cannot be mutated, and assignment context is not returned.",
  ),
  blocked(
    "google_tasks_raw",
    "Run broad, delegated, or raw operations",
    "Automatic pagination, service accounts, domain delegation, raw API calls, and raw MCP tools are blocked in V1.",
  ),
];
const identifier = {
  type: "string",
  minLength: 1,
  maxLength: 200,
  pattern: "^[A-Za-z0-9_:-]+$",
};
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const idempotencyKey = { type: "string", minLength: 8, maxLength: 200 };

export const GOOGLE_TASKS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-tasks",
  name: "Google Tasks",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.google.com/workspace/tasks/auth",
  providerWebsiteUrl: "https://tasks.google.com/",
  capabilities: [
    {
      ...capability(
        "task_read",
        "Read task lists and tasks",
        "Read bounded first-page TaskList and Task summaries.",
        true,
      ),
      platformCapability: "google_tasks_task_read",
    },
    {
      ...capability(
        "task_draft",
        "Prepare task changes",
        "Validate and hash non-destructive task changes locally.",
        true,
      ),
      platformCapability: "google_tasks_task_draft",
    },
    {
      ...capability(
        "task_write",
        "Create and patch tasks",
        "Create top-level tasks and safely patch unassigned tasks after policy checks.",
        true,
      ),
      platformCapability: "google_tasks_task_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_TASKS_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GOOGLE_OAUTH_CLIENT_ID",
        label: "Google OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console confidential web OAuth client ID.",
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Google OAuth client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "googleTasks.listTaskLists",
      functionName: "google_tasks_tasklists_list",
      aliases: ["google_tasks_tasklists_list"],
      capability: "task_read",
      platformCapability: "google_tasks_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read the first twenty TaskLists without following pagination.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "googleTasks.listTasks",
      functionName: "google_tasks_tasks_list",
      aliases: ["google_tasks_tasks_list"],
      capability: "task_read",
      platformCapability: "google_tasks_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read the first one hundred non-deleted tasks from one TaskList.",
      inputSchema: {
        type: "object",
        properties: { taskListId: identifier },
        required: ["taskListId"],
        additionalProperties: false,
      },
    },
    {
      name: "googleTasks.prepareUpdate",
      functionName: "google_tasks_update_prepare",
      aliases: ["google_tasks_update_prepare"],
      capability: "task_draft",
      platformCapability: "google_tasks_task_draft",
      action: "draft",
      approvalRequired: false,
      description: "Validate and hash one create or patch operation locally.",
      inputSchema: {
        type: "object",
        properties: {
          taskListId: identifier,
          taskId: identifier,
          operation: { type: "string", enum: ["create", "patch"] },
          title: { type: "string", minLength: 1, maxLength: 1024 },
          notes: { type: "string", minLength: 1, maxLength: 8192 },
          dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          status: { type: "string", enum: ["needsAction", "completed"] },
        },
        required: ["taskListId", "operation"],
        additionalProperties: false,
      },
    },
    {
      name: "googleTasks.createTask",
      functionName: "google_tasks_task_create",
      aliases: ["google_tasks_task_create"],
      capability: "task_write",
      platformCapability: "google_tasks_task_write",
      action: "write",
      approvalRequired: true,
      description:
        "Create one top-level task with bounded title, notes, and date-only due date.",
      inputSchema: {
        type: "object",
        properties: {
          taskListId: identifier,
          title: { type: "string", minLength: 1, maxLength: 1024 },
          notes: { type: "string", minLength: 1, maxLength: 8192 },
          dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          approvalId,
          idempotencyKey,
        },
        required: ["taskListId", "title", "approvalId", "idempotencyKey"],
        additionalProperties: false,
      },
    },
    {
      name: "googleTasks.patchTask",
      functionName: "google_tasks_task_patch",
      aliases: ["google_tasks_task_patch"],
      capability: "task_write",
      platformCapability: "google_tasks_task_write",
      action: "write",
      approvalRequired: true,
      description:
        "Patch allowlisted fields on one unassigned Task using its exact ETag.",
      inputSchema: {
        type: "object",
        properties: {
          taskListId: identifier,
          taskId: identifier,
          etag: { type: "string", minLength: 1, maxLength: 512 },
          title: { type: "string", minLength: 1, maxLength: 1024 },
          notes: { type: "string", minLength: 1, maxLength: 8192 },
          dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          status: { type: "string", enum: ["needsAction", "completed"] },
          approvalId,
          idempotencyKey,
        },
        required: [
          "taskListId",
          "taskId",
          "etag",
          "approvalId",
          "idempotencyKey",
        ],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "google_tasks_safe",
      label: "Safe",
      description:
        "Bounded first-page reads and local preparation run automatically; task creation and safe patching require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All five selected tools run without Relay per-action approval while exact scope, non-destructive boundaries, assigned-task preflight, ETags, limits, audit, redaction, refresh, revocation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "non-destructive-tasks",
      label:
        "Google account, exact Tasks scope, refresh lifecycle, and non-destructive task access",
      requiredScopes: GOOGLE_TASKS_SCOPES,
    },
  ],
};
