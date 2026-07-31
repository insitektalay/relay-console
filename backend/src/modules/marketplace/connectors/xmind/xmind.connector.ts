import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { XMIND_READ_TOOLS, XMIND_WRITE_TOOLS } from "./xmind-mcp.adapter";

export const XMIND_SCOPES = ["mcp:connect"] as const;

const reads = [
  action(
    "xmind_mcp_read",
    "Read XMind maps",
    "List recent cloud mind maps or read one authorized map through the official hosted MCP.",
  ),
];
const writes = [
  action(
    "xmind_mcp_write",
    "Create or edit XMind maps",
    "Create a cloud mind map or change an existing map; Safe mode requires approval.",
  ),
];

export const XMIND_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "xmind",
  name: "XMind",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://xmind.com/user-guide/xmind-mcp",
  providerWebsiteUrl: "https://xmind.com/",
  capabilities: [
    {
      ...capability(
        "mind_map_read",
        "Read mind maps",
        "List recently opened XMind cloud maps and read an authorized map as structured content.",
        true,
      ),
      platformCapability: "xmind_mind_map_read",
    },
    {
      ...capability(
        "mind_map_write",
        "Create and edit mind maps",
        "Create a new cloud mind map in one of XMind's supported structures or revise an existing map while preserving its visual style.",
        true,
      ),
      platformCapability: "xmind_mind_map_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.xmind.com/oauth/consent",
      tokenUrl: "https://app.xmind.com/api/oauth/token",
      userInfoUrl: "https://app.xmind.com/api/mcp",
      requiredScopes: [...XMIND_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "XMIND_MCP_CLIENT_ID",
        label: "XMind MCP OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay's dynamically registered public PKCE client ID, configured on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "xmind.read",
      functionName: "xmind_read",
      aliases: ["xmind.read", "xmind_read", "xmind_mcp_read"],
      capability: "mind_map_read",
      platformCapability: "xmind_mind_map_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one exact documented XMind MCP read tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...XMIND_READ_TOOLS] },
          arguments: { type: "object" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "xmind.write",
      functionName: "xmind_write",
      aliases: ["xmind.write", "xmind_write", "xmind_mcp_write"],
      capability: "mind_map_write",
      platformCapability: "xmind_mind_map_write",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one exact documented XMind MCP create or edit tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...XMIND_WRITE_TOOLS] },
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
      id: "xmind_safe",
      label: "Safe",
      description:
        "Listing and reading maps runs directly; creating or editing cloud maps requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected OAuth-authorized XMind MCP operations run without Relay per-action approval; ownership, provider permissions, exact tool allowlists, live schemas, bounds, audits, and redaction still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "XMind OAuth and exact four-tool MCP capability check",
    },
  ],
};
