import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { WHIMSICAL_READ_TOOLS, WHIMSICAL_WRITE_TOOLS } from "./whimsical-mcp.adapter";

export const WHIMSICAL_SCOPES = ["profile", "mcp:read", "mcp:write"] as const;

const reads = [
  action(
    "whimsical_mcp_read",
    "Read Whimsical content",
    "Use one documented Whimsical workspace, file, folder, search, or comment read tool.",
  ),
];
const writes = [
  action(
    "whimsical_mcp_write",
    "Create or change Whimsical content",
    "Create or edit files, visual objects, layouts, folders, documents, or comments; Safe mode requires approval.",
  ),
];

export const WHIMSICAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "whimsical",
  name: "Whimsical",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://whimsical.com/learn/integrations/mcp",
  providerWebsiteUrl: "https://whimsical.com/",
  capabilities: [
    {
      ...capability(
        "workspace_knowledge",
        "Read workspace content",
        "List workspaces, browse folders, search content, fetch boards or documents, and read comments.",
        true,
      ),
      platformCapability: "whimsical_workspace_knowledge",
    },
    {
      ...capability(
        "visual_creation",
        "Create visual work",
        "Create boards, flowcharts, mind maps, sequence diagrams, wireframes, sticky notes, tables, and documents.",
        true,
      ),
      platformCapability: "whimsical_visual_creation",
    },
    {
      ...capability(
        "content_management",
        "Edit and organize content",
        "Edit boards, documents, wireframes, layouts, files, folders, and comment threads.",
        true,
      ),
      platformCapability: "whimsical_content_management",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.whimsical.com/v1/oauth.authorize",
      tokenUrl: "https://api.whimsical.com/v1/oauth.token",
      revocationUrl: "https://api.whimsical.com/v1/oauth.revoke",
      userInfoUrl: "https://mcp.whimsical.com/mcp",
      requiredScopes: [...WHIMSICAL_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "WHIMSICAL_MCP_CLIENT_ID",
        label: "Whimsical MCP OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay's dynamically registered public PKCE client ID, configured on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "whimsical.read",
      functionName: "whimsical_read",
      aliases: ["whimsical.read", "whimsical_read", "whimsical_mcp_read"],
      capability: "workspace_knowledge",
      platformCapability: "whimsical_workspace_knowledge",
      action: "read",
      approvalRequired: false,
      description: "Invoke one exact documented Whimsical MCP read tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...WHIMSICAL_READ_TOOLS] },
          arguments: { type: "object" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "whimsical.write",
      functionName: "whimsical_write",
      aliases: ["whimsical.write", "whimsical_write", "whimsical_mcp_write"],
      capability: "content_management",
      platformCapability: "whimsical_content_management",
      action: "write",
      approvalRequired: true,
      description: "Invoke one exact documented Whimsical creation, edit, layout, folder, or comment tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...WHIMSICAL_WRITE_TOOLS] },
          arguments: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "whimsical_safe",
      label: "Safe",
      description: "Workspace, folder, file, search, and comment reads run directly; content and comment changes require approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: "Every selected OAuth-authorized Whimsical MCP operation runs without Relay per-action approval; ownership, provider permissions, exact tool allowlists, live schemas, bounds, audits, and redaction still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "oauth_and_mcp_tools", label: "Whimsical OAuth and exact 11-tool MCP capability check" },
  ],
};
