import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "ticktick_project_list",
    "List projects",
    "List at most twenty-five TickTick project summaries.",
  ),
  action(
    "ticktick_project_data_get",
    "Read project data",
    "Read one TickTick project and at most twenty-five of its task summaries.",
  ),
  action(
    "ticktick_task_get",
    "Read a task",
    "Read one TickTick task by exact project and task IDs.",
  ),
];
const fullApi = [
  action(
    "ticktick_full_api",
    "Use full TickTick Open API",
    "Use any documented TickTick Open API v1 operation authorized by the connection; Safe mode requires approval.",
  ),
];

export const TICKTICK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ticktick",
  name: "TickTick",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.ticktick.com/docs/index.html#/openapi",
  providerWebsiteUrl: "https://ticktick.com/",
  capabilities: [
    {
      ...capability(
        "project_task_read",
        "Read projects and tasks",
        "Read bounded project and task data from the connected TickTick grant.",
        true,
      ),
      platformCapability: "ticktick_project_task_read",
    },
    {
      ...capability(
        "full_api",
        "Full TickTick Open API",
        "Use the documented Open API v1 surface allowed by the connected user.",
        true,
      ),
      platformCapability: "ticktick_full_api",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://ticktick.com/oauth/authorize",
      tokenUrl: "https://ticktick.com/oauth/token",
      requiredScopes: ["tasks:read", "tasks:write"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "ticktick.listProjects",
      functionName: "ticktick_project_list",
      aliases: ["ticktick.listProjects", "ticktick_project_list"],
      capability: "project_task_read",
      platformCapability: "ticktick_project_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five project summaries from the connected TickTick grant.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "ticktick.getProjectData",
      functionName: "ticktick_project_data_get",
      aliases: ["ticktick.getProjectData", "ticktick_project_data_get"],
      capability: "project_task_read",
      platformCapability: "ticktick_project_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact TickTick project with at most twenty-five task summaries.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" },
          taskLimit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
    },
    {
      name: "ticktick.getTask",
      functionName: "ticktick_task_get",
      aliases: ["ticktick.getTask", "ticktick_task_get"],
      capability: "project_task_read",
      platformCapability: "ticktick_project_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one TickTick task by exact opaque project and task IDs.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" },
          taskId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" },
        },
        required: ["projectId", "taskId"],
        additionalProperties: false,
      },
    },
    {
      name: "ticktick.request",
      functionName: "ticktick_request",
      aliases: ["ticktick.request", "ticktick_request", "ticktick_full_api"],
      capability: "full_api",
      platformCapability: "ticktick_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented TickTick Open API v1 method and relative path on the fixed API origin. Absolute URLs and credential-bearing fields are rejected.",
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
      id: "ticktick_safe",
      label: "Safe",
      description:
        "Bounded project and task reads run directly; every other TickTick API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected TickTick operation runs without Relay per-action approval; secret isolation, fixed routing, request bounds, audits, TickTick authorization, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "project-list", label: "TickTick access-grant validation" },
  ],
};
