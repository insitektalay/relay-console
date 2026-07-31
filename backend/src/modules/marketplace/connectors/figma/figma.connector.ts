import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "figma_api_read",
    "Read Figma design data",
    "Use any selected bounded Figma read operation for files, projects, libraries, comments, versions, variables, dev resources, or webhooks.",
  ),
];
const writes = [
  action(
    "figma_api_write",
    "Change supported Figma resources",
    "Post or delete comments and reactions, manage variables, dev resources, or webhooks; Safe mode requires approval.",
  ),
];
const unavailable = [
  blocked(
    "figma_canvas_write",
    "Edit the design canvas remotely",
    "Figma's external REST API does not create, move, resize, restyle, or delete canvas nodes; canvas editing requires a plugin running inside Figma.",
  ),
  blocked(
    "figma_enterprise_governance",
    "Run enterprise governance APIs",
    "Organization activity, discovery, developer-log, AI-metering, SCIM, payment, and library-analytics administration are outside this user design-workflow connection.",
  ),
];

export const FIGMA_SCOPES = [
  "current_user:read",
  "file_content:read",
  "file_metadata:read",
  "file_comments:read",
  "file_comments:write",
  "file_versions:read",
  "file_dev_resources:read",
  "file_dev_resources:write",
  "file_variables:read",
  "file_variables:write",
  "library_assets:read",
  "library_content:read",
  "team_library_content:read",
  "project_metadata:read",
  "projects:read",
  "selections:read",
  "webhooks:read",
  "webhooks:write",
] as const;

export const FIGMA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "figma",
  name: "Figma",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.figma.com/docs/rest-api/",
  providerWebsiteUrl: "https://www.figma.com/",
  capabilities: [
    {
      ...capability(
        "design_read",
        "Read design files",
        "Read bounded file metadata, node trees, selected nodes, renders, image fills, versions, selections, comments, and reactions for files the user can access.",
        true,
      ),
      platformCapability: "figma_design_read",
    },
    {
      ...capability(
        "project_library_read",
        "Read projects and libraries",
        "List selected teams, projects, project files, published components, component sets, styles, and library content.",
        true,
      ),
      platformCapability: "figma_project_library_read",
    },
    {
      ...capability(
        "comment_management",
        "Manage comments and reactions",
        "Post, reply to, delete, and react to comments on explicit files.",
        true,
      ),
      platformCapability: "figma_comment_management",
    },
    {
      ...capability(
        "developer_handoff",
        "Manage developer resources",
        "Read, create, update, and delete developer links attached to explicit nodes.",
        true,
      ),
      platformCapability: "figma_developer_handoff",
    },
    {
      ...capability(
        "variable_management",
        "Manage variables",
        "Read and change variables and collections where the connected Enterprise account and file permissions allow it.",
        true,
      ),
      platformCapability: "figma_variable_management",
    },
    {
      ...capability(
        "webhook_management",
        "Manage webhooks",
        "Create, inspect, update, and delete Figma webhooks for explicit team, project, or file contexts.",
        true,
      ),
      platformCapability: "figma_webhook_management",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.figma.com/oauth",
      tokenUrl: "https://api.figma.com/v1/oauth/token",
      refreshUrl: "https://api.figma.com/v1/oauth/token",
      userInfoUrl: "https://api.figma.com/v1/me",
      requiredScopes: [...FIGMA_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "FIGMA_CLIENT_ID",
        label: "Figma OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned public Figma app client ID configured on Railway.",
      },
      {
        name: "FIGMA_CLIENT_SECRET",
        label: "Figma OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned Figma app client secret stored only in Railway secret variables.",
      },
    ],
  },
  tools: [
    {
      name: "figma.read",
      functionName: "figma_read",
      aliases: ["figma.read", "figma_read", "figma_api_read"],
      capability: "design_read",
      platformCapability: "figma_design_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call one exact supported GET route on Figma's fixed API origin with bounded query and response data.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", pattern: "^/v[12]/" },
          query: { type: "object" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "figma.write",
      functionName: "figma_write",
      aliases: ["figma.write", "figma_write", "figma_api_write"],
      capability: "comment_management",
      platformCapability: "figma_comment_management",
      action: "write",
      approvalRequired: true,
      description:
        "Call one exact supported comment, reaction, dev-resource, variable, or webhook mutation on Figma's fixed API origin.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          path: { type: "string", pattern: "^/v[12]/" },
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
      id: "figma_safe",
      label: "Safe",
      description:
        "Design, project, library, comment, variable, dev-resource, and webhook reads run directly; every supported mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: unavailable,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected OAuth-authorized Figma REST operation runs without Relay per-action approval; fixed origins, exact routes, request bounds, audits, redaction, provider permissions, plan restrictions, and the absence of a remote canvas-write API still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: unavailable,
    },
  ],
  healthChecks: [
    {
      id: "current_user",
      label: "Figma OAuth token and current-user validation",
      requiredScopes: ["current_user:read"],
    },
  ],
};
