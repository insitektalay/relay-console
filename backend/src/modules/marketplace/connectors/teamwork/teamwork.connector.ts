import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "teamwork_project_list",
    "List projects",
    "List at most twenty-five Teamwork project summaries.",
  ),
  action(
    "teamwork_task_list",
    "List tasks",
    "List at most twenty-five Teamwork task summaries.",
  ),
  action(
    "teamwork_task_get",
    "Read a task",
    "Read one Teamwork task summary by task ID.",
  ),
];
const fullApi = [
  action(
    "teamwork_full_api",
    "Use full Teamwork API",
    "Use any documented Teamwork Projects API operation authorized by the connection; Safe mode requires approval.",
  ),
];

export const TEAMWORK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "teamwork",
  name: "Teamwork",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://apidocs.teamwork.com/guides/teamwork/app-login-flow",
  providerWebsiteUrl: "https://www.teamwork.com/",
  capabilities: [
    {
      ...capability(
        "project_read",
        "Read projects",
        "Read bounded project summaries from the connected Teamwork installation.",
        true,
      ),
      platformCapability: "teamwork_project_read",
    },
    {
      ...capability(
        "task_read",
        "Read tasks",
        "Read bounded task summaries from the connected Teamwork installation.",
        true,
      ),
      platformCapability: "teamwork_task_read",
    },
    {
      ...capability(
        "full_api",
        "Full Teamwork Projects API",
        "Use the complete documented Teamwork Projects API surface allowed by the connected user and installation.",
        true,
      ),
      platformCapability: "teamwork_full_api",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.teamwork.com/launchpad/login/",
      tokenUrl: "https://www.teamwork.com/launchpad/v1/token.json",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "teamwork.listProjects",
      functionName: "teamwork_project_list",
      aliases: ["teamwork.listProjects", "teamwork_project_list"],
      capability: "project_read",
      platformCapability: "teamwork_project_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five project summaries from the connected Teamwork installation.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "teamwork.listTasks",
      functionName: "teamwork_task_list",
      aliases: ["teamwork.listTasks", "teamwork_task_list"],
      capability: "task_read",
      platformCapability: "teamwork_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five task summaries from the connected Teamwork installation.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "teamwork.getTask",
      functionName: "teamwork_task_get",
      aliases: ["teamwork.getTask", "teamwork_task_get"],
      capability: "task_read",
      platformCapability: "teamwork_task_read",
      action: "read",
      approvalRequired: false,
      description: "Read one Teamwork task summary by numeric task ID.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string", pattern: "^[1-9][0-9]{0,18}$" },
        },
        required: ["taskId"],
        additionalProperties: false,
      },
    },
    {
      name: "teamwork.request",
      functionName: "teamwork_request",
      aliases: ["teamwork.request", "teamwork_request", "teamwork_full_api"],
      capability: "full_api",
      platformCapability: "teamwork_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Teamwork Projects API method and relative path on the exact connected installation origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          path: { type: "string", pattern: "^/projects/api/" },
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
      id: "teamwork_safe",
      label: "Safe",
      description:
        "Bounded project and task reads run directly; every other Teamwork API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Teamwork operation runs without Relay per-action approval; installation binding, secret isolation, request bounds, audits, provider permissions, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "installation-identity",
      label: "Teamwork authorization and exact installation validation",
    },
  ],
};
