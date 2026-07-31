import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { SLITE_READ_TOOLS, SLITE_WRITE_TOOLS } from "./slite-mcp.adapter";

export const SLITE_SCOPES = [
  "openid",
  "email",
  "mcp:read",
  "mcp:write",
  "offline_access",
];

const reads = [
  action(
    "slite_mcp_read",
    "Use read tools",
    "Use one of Slite's documented read-only MCP tools with bounded arguments.",
  ),
];
const writes = [
  action(
    "slite_mcp_write",
    "Use write tools",
    "Use one of Slite's documented mutation MCP tools; Safe mode requires approval.",
  ),
];

export const SLITE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "slite",
  name: "Slite",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://slite.com/help/77mvFqJWG1tduF/Slite-MCP",
  providerWebsiteUrl: "https://slite.com/",
  capabilities: [
    {
      ...capability(
        "knowledge_read",
        "Read workspace knowledge",
        "Ask, search, retrieve docs, inspect channels, users, groups, comments, recent activity, and knowledge-management queues.",
        true,
      ),
      platformCapability: "slite_knowledge_read",
    },
    {
      ...capability(
        "knowledge_write",
        "Create and maintain knowledge",
        "Create, update, move, archive, restore, verify, comment on, and structurally edit permitted Slite content.",
        true,
      ),
      platformCapability: "slite_knowledge_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://slite.com/api/mcp/oauth/auth",
      tokenUrl: "https://slite.com/api/mcp/oauth/token",
      userInfoUrl: "https://api.slite.com/mcp",
      requiredScopes: SLITE_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SLITE_CLIENT_ID",
        label: "Slite OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay's dynamically registered public PKCE client ID, configured on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "slite.read",
      functionName: "slite_read",
      aliases: ["slite.read", "slite_read", "slite_mcp_read"],
      capability: "knowledge_read",
      platformCapability: "slite_knowledge_read",
      action: "read",
      approvalRequired: false,
      description: "Invoke one exact documented Slite MCP read tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...SLITE_READ_TOOLS] },
          arguments: { type: "object" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "slite.write",
      functionName: "slite_write",
      aliases: ["slite.write", "slite_write", "slite_mcp_write"],
      capability: "knowledge_write",
      platformCapability: "slite_knowledge_write",
      action: "write",
      approvalRequired: true,
      description: "Invoke one exact documented Slite MCP mutation tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...SLITE_WRITE_TOOLS] },
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
      id: "slite_safe",
      label: "Safe",
      description: "Documented reads run directly; every create, update, move, archive, restore, verification, comment, and structural mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: "Every selected OAuth-authorized Slite MCP operation runs without Relay per-action approval; ownership, OAuth scope, exact tool allowlists, bounds, audits, schema validation, and Slite permissions still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "Slite OAuth refresh and documented MCP capability check",
      requiredScopes: SLITE_SCOPES,
    },
  ],
};
