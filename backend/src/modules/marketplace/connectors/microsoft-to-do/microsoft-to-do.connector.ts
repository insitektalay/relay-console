import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MICROSOFT_TO_DO_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "Tasks.Read",
];

const reads = [
  action(
    "microsoft_todo_task_lists_list",
    "List task lists",
    "List at most twenty-five bounded task lists for the signed-in Microsoft account.",
  ),
  action(
    "microsoft_todo_task_list_get",
    "Read task-list metadata",
    "Read bounded metadata for one explicit prior-result Microsoft To Do task list.",
  ),
  action(
    "microsoft_todo_tasks_list",
    "List tasks",
    "List at most twenty-five privacy-scrubbed tasks from one explicit prior-result task list.",
  ),
  action(
    "microsoft_todo_task_get",
    "Read task metadata",
    "Read privacy-scrubbed metadata for one explicit prior-result task without body or related content.",
  ),
];

const blockedActions = [
  blocked(
    "microsoft_todo_private_content",
    "Read task bodies or related content",
    "Bodies, categories, checklist items, linked resources, attachments, source links, and related content are outside V1.",
  ),
  blocked(
    "microsoft_todo_shared_expansion",
    "Expand shared tasks or collaborators",
    "Shared-task expansion, collaborator identities, people, groups, and directory access are outside V1.",
  ),
  blocked(
    "microsoft_todo_mutation",
    "Change To Do resources",
    "Create, update, complete, move, reorder, and delete operations are outside V1.",
  ),
  blocked(
    "microsoft_todo_application_raw",
    "Use broad or raw access",
    "Application permissions, other-user access, delta, extensions, exports, automatic pagination, beta APIs, and raw Graph access are outside V1.",
  ),
];

const identifier = { type: "string", pattern: "^[A-Za-z0-9._!~=-]{1,512}$" };

export const MICROSOFT_TO_DO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-to-do",
    name: "Microsoft To Do",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://learn.microsoft.com/graph/todo-concept-overview",
    providerWebsiteUrl:
      "https://www.microsoft.com/microsoft-365/microsoft-to-do-list-app",
    capabilities: [
      {
        ...capability(
          "task_lists",
          "Read task lists",
          "Review bounded task-list metadata for the signed-in Microsoft account.",
          true,
        ),
        platformCapability: "microsoft_todo_task_lists_read",
      },
      {
        ...capability(
          "task_metadata",
          "Read task metadata",
          "Review bounded, privacy-scrubbed tasks in one explicit task list.",
          true,
        ),
        platformCapability: "microsoft_todo_tasks_read",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl:
          "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        authority: {
          provider: "microsoft",
          defaultMode: "multi_tenant_common",
          tenantIdEnv: "MICROSOFT_TENANT_ID",
        },
        requiredScopes: MICROSOFT_TO_DO_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "MICROSOFT_CLIENT_ID",
          label: "Microsoft application client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          requiredForAuthTypes: ["oauth"],
          helpText:
            "Relay-owned Entra application ID configured only on Railway.",
        },
        {
          name: "MICROSOFT_CLIENT_SECRET",
          label: "Microsoft application client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["oauth"],
          helpText: "Relay-owned Entra secret retained only by Railway.",
        },
      ],
    },
    tools: [
      {
        name: "microsoft-to-do.listTaskLists",
        functionName: "microsoft_todo_task_lists_list",
        aliases: [
          "microsoft-to-do.listTaskLists",
          "microsoft_todo_task_lists_list",
        ],
        capability: "task_lists",
        platformCapability: "microsoft_todo_task_lists_read",
        action: "read",
        approvalRequired: false,
        description:
          "List at most twenty-five bounded Microsoft To Do task lists for the signed-in user.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-to-do.getTaskList",
        functionName: "microsoft_todo_task_list_get",
        aliases: [
          "microsoft-to-do.getTaskList",
          "microsoft_todo_task_list_get",
        ],
        capability: "task_lists",
        platformCapability: "microsoft_todo_task_lists_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded metadata for one explicit prior-result Microsoft To Do task list.",
        inputSchema: {
          type: "object",
          properties: { taskListId: identifier },
          required: ["taskListId"],
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-to-do.listTasks",
        functionName: "microsoft_todo_tasks_list",
        aliases: ["microsoft-to-do.listTasks", "microsoft_todo_tasks_list"],
        capability: "task_metadata",
        platformCapability: "microsoft_todo_tasks_read",
        action: "read",
        approvalRequired: false,
        description:
          "List at most twenty-five privacy-scrubbed tasks from one explicit prior-result task list.",
        inputSchema: {
          type: "object",
          properties: { taskListId: identifier },
          required: ["taskListId"],
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-to-do.getTask",
        functionName: "microsoft_todo_task_get",
        aliases: ["microsoft-to-do.getTask", "microsoft_todo_task_get"],
        capability: "task_metadata",
        platformCapability: "microsoft_todo_tasks_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read privacy-scrubbed metadata for one explicit prior-result task.",
        inputSchema: {
          type: "object",
          properties: { taskListId: identifier, taskId: identifier },
          required: ["taskListId", "taskId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_todo_safe",
        label: "Safe",
        description:
          "Four bounded delegated reads run automatically; private content, shared expansion, writes, application access, delta, pagination, beta, and raw Graph remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same four delegated reads run without Relay per-action approval; exact scope, signed-in-user authority, limits, audit, redaction, and Microsoft controls still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "task_lists",
        label:
          "Microsoft personal or work account authorization, exact scope, expiry, refresh, and bounded To Do validation",
        requiredScopes: MICROSOFT_TO_DO_SCOPES,
      },
    ],
  };
