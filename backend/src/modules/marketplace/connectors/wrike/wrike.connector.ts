import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "wrike_project_list",
    "List projects",
    "List at most twenty-five Wrike project or folder summaries.",
  ),
  action(
    "wrike_task_list",
    "List tasks",
    "List at most twenty-five recently updated Wrike task summaries.",
  ),
  action(
    "wrike_task_get",
    "Read a task",
    "Read one Wrike task summary by task ID.",
  ),
];
const fullApi = [
  action(
    "wrike_full_api",
    "Use full Wrike API",
    "Use any documented Wrike API operation authorized by the connection; Safe mode requires approval.",
  ),
];

export const WRIKE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "wrike",
  name: "Wrike",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.wrike.com/docs/oauth-20-authorization",
  providerWebsiteUrl: "https://www.wrike.com/",
  capabilities: [
    {
      ...capability(
        "project_read",
        "Read projects",
        "Read bounded folder and project summaries from the connected Wrike account.",
        true,
      ),
      platformCapability: "wrike_project_read",
    },
    {
      ...capability(
        "task_read",
        "Read tasks",
        "Read bounded task summaries from the connected Wrike account.",
        true,
      ),
      platformCapability: "wrike_task_read",
    },
    {
      ...capability(
        "full_api",
        "Full Wrike API",
        "Use the complete documented Wrike API surface allowed by the connected user and account.",
        true,
      ),
      platformCapability: "wrike_full_api",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://login.wrike.com/oauth2/authorize/v4",
      tokenUrl: "https://login.wrike.com/oauth2/token",
      requiredScopes: ["wsReadWrite"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "wrike.listProjects",
      functionName: "wrike_project_list",
      aliases: ["wrike.listProjects", "wrike_project_list"],
      capability: "project_read",
      platformCapability: "wrike_project_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five project or folder summaries from the connected Wrike account.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "wrike.listTasks",
      functionName: "wrike_task_list",
      aliases: ["wrike.listTasks", "wrike_task_list"],
      capability: "task_read",
      platformCapability: "wrike_task_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five recently updated task summaries from the connected Wrike account.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "wrike.getTask",
      functionName: "wrike_task_get",
      aliases: ["wrike.getTask", "wrike_task_get"],
      capability: "task_read",
      platformCapability: "wrike_task_read",
      action: "read",
      approvalRequired: false,
      description: "Read one Wrike task summary by opaque task ID.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,200}$" },
        },
        required: ["taskId"],
        additionalProperties: false,
      },
    },
    {
      name: "wrike.request",
      functionName: "wrike_request",
      aliases: ["wrike.request", "wrike_request", "wrike_full_api"],
      capability: "full_api",
      platformCapability: "wrike_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Wrike API method and relative path on the exact regional API origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          path: { type: "string", pattern: "^/" },
          query: { type: "object" },
          form: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "wrike_safe",
      label: "Safe",
      description:
        "Bounded project and task reads run directly; every other Wrike API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Wrike operation runs without Relay per-action approval; account binding, secret isolation, request bounds, audits, provider permissions, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "account-user",
      label: "Wrike account, current user, and exact regional host validation",
    },
  ],
};
