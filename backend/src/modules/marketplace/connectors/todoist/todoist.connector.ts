import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "todoist_project_list",
    "List projects",
    "List at most twenty-five Todoist project summaries.",
  ),
  action(
    "todoist_task_list",
    "List active tasks",
    "List at most twenty-five active Todoist task summaries.",
  ),
  action(
    "todoist_task_get",
    "Read a task",
    "Read one active Todoist task by exact opaque task ID.",
  ),
];

const fullApi = [
  action(
    "todoist_full_api",
    "Use full Todoist JSON API",
    "Use any documented JSON Todoist API v1 operation authorized by the connection; Safe mode requires approval.",
  ),
];

export const TODOIST_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "todoist",
  name: "Todoist",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.todoist.com/api/v1/",
  providerWebsiteUrl: "https://todoist.com/",
  capabilities: [
    {
      ...capability(
        "project_task_read",
        "Read projects and tasks",
        "Read bounded project and active-task data from the connected Todoist user.",
        true,
      ),
      platformCapability: "todoist_project_task_read",
    },
    {
      ...capability(
        "full_api",
        "Full Todoist JSON API",
        "Use the documented JSON Todoist API v1 surface allowed by the connected user and plan.",
        true,
      ),
      platformCapability: "todoist_full_api",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.todoist.com/oauth/authorize",
      tokenUrl: "https://api.todoist.com/oauth/access_token",
      requiredScopes: [
        "data:read_write",
        "data:delete",
        "project:delete",
        "backups:read",
      ],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "todoist.listProjects",
      functionName: "todoist_project_list",
      aliases: ["todoist.listProjects", "todoist_project_list"],
      capability: "project_task_read",
      platformCapability: "todoist_project_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five project summaries from the connected Todoist user.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "todoist.listTasks",
      functionName: "todoist_task_list",
      aliases: ["todoist.listTasks", "todoist_task_list"],
      capability: "project_task_read",
      platformCapability: "todoist_project_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five active task summaries from the connected Todoist user.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "todoist.getTask",
      functionName: "todoist_task_get",
      aliases: ["todoist.getTask", "todoist_task_get"],
      capability: "project_task_read",
      platformCapability: "todoist_project_task_read",
      action: "read",
      approvalRequired: false,
      description: "Read one active Todoist task by exact opaque task ID.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" },
        },
        required: ["taskId"],
        additionalProperties: false,
      },
    },
    {
      name: "todoist.request",
      functionName: "todoist_request",
      aliases: ["todoist.request", "todoist_request", "todoist_full_api"],
      capability: "full_api",
      platformCapability: "todoist_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Todoist API v1 JSON method and relative path on the fixed API origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          path: { type: "string", pattern: "^/" },
          query: { type: "object" },
          json: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "todoist_safe",
      label: "Safe",
      description:
        "Bounded project and task reads run directly; every other Todoist API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Todoist operation runs without Relay per-action approval; user binding, secret isolation, request bounds, audits, Todoist authorization, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "current-user",
      label: "Todoist exact authorizing-user validation",
    },
  ],
};
