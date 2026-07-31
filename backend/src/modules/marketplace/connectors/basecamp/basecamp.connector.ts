import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "basecamp_project_list",
    "List projects",
    "List at most twenty-five Basecamp project summaries.",
  ),
  action(
    "basecamp_project_get",
    "Read a project",
    "Read one Basecamp project summary by project ID.",
  ),
  action(
    "basecamp_todo_get",
    "Read a to-do",
    "Read one Basecamp to-do summary by to-do ID.",
  ),
];
const fullApi = [
  action(
    "basecamp_full_api",
    "Use full Basecamp API",
    "Use any documented Basecamp API operation authorized by the connection; Safe mode requires approval.",
  ),
];

export const BASECAMP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "basecamp",
  name: "Basecamp",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://github.com/basecamp/bc-api/blob/master/sections/authentication.md",
  providerWebsiteUrl: "https://basecamp.com/",
  capabilities: [
    {
      ...capability(
        "project_read",
        "Read projects",
        "Read bounded project summaries from the connected Basecamp account.",
        true,
      ),
      platformCapability: "basecamp_project_read",
    },
    {
      ...capability(
        "todo_read",
        "Read to-dos",
        "Read bounded to-do summaries from the connected Basecamp account.",
        true,
      ),
      platformCapability: "basecamp_todo_read",
    },
    {
      ...capability(
        "full_api",
        "Full Basecamp API",
        "Use the complete documented Basecamp API surface allowed by the connected person and account.",
        true,
      ),
      platformCapability: "basecamp_full_api",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://launchpad.37signals.com/authorization/new",
      tokenUrl: "https://launchpad.37signals.com/authorization/token",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "basecamp.listProjects",
      functionName: "basecamp_project_list",
      aliases: ["basecamp.listProjects", "basecamp_project_list"],
      capability: "project_read",
      platformCapability: "basecamp_project_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five project summaries from the connected Basecamp account.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "basecamp.getProject",
      functionName: "basecamp_project_get",
      aliases: ["basecamp.getProject", "basecamp_project_get"],
      capability: "project_read",
      platformCapability: "basecamp_project_read",
      action: "read",
      approvalRequired: false,
      description: "Read one Basecamp project summary by numeric project ID.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", pattern: "^[1-9][0-9]{0,18}$" },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
    },
    {
      name: "basecamp.getTodo",
      functionName: "basecamp_todo_get",
      aliases: ["basecamp.getTodo", "basecamp_todo_get"],
      capability: "todo_read",
      platformCapability: "basecamp_todo_read",
      action: "read",
      approvalRequired: false,
      description: "Read one Basecamp to-do summary by numeric to-do ID.",
      inputSchema: {
        type: "object",
        properties: {
          todoId: { type: "string", pattern: "^[1-9][0-9]{0,18}$" },
        },
        required: ["todoId"],
        additionalProperties: false,
      },
    },
    {
      name: "basecamp.request",
      functionName: "basecamp_request",
      aliases: ["basecamp.request", "basecamp_request", "basecamp_full_api"],
      capability: "full_api",
      platformCapability: "basecamp_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Basecamp API method and relative path on the exact connected account origin. Absolute URLs and credential-bearing fields are rejected.",
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
      id: "basecamp_safe",
      label: "Safe",
      description:
        "Bounded project and to-do reads run directly; every other Basecamp API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Basecamp operation runs without Relay per-action approval; account binding, secret isolation, request bounds, audits, provider permissions, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "account-authorization",
      label: "Basecamp authorization and exact bc3 account validation",
    },
  ],
};
