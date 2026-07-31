import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const CLOUDINARY_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "asset_management",
  "upload",
] as const;

const reads = [
  action(
    "cloudinary_mcp_read",
    "Read Cloudinary assets",
    "Use one live-discovered Asset Management MCP tool that is verified as non-mutating.",
  ),
];
const writes = [
  action(
    "cloudinary_mcp_write",
    "Change Cloudinary assets",
    "Use one live-discovered Asset Management MCP mutation; Safe mode requires approval.",
  ),
];
const blocked = [
  action(
    "cloudinary_credential_exposure",
    "Expose OAuth credentials",
    "OAuth material never enters tool arguments or results.",
  ),
  action(
    "cloudinary_alternate_mcp_origin",
    "Call an alternate MCP server",
    "This connection is pinned to Cloudinary's Asset Management MCP origin.",
  ),
];

export const CLOUDINARY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "cloudinary",
  name: "Cloudinary",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://cloudinary.com/documentation/cloudinary_llm_mcp",
  providerWebsiteUrl: "https://cloudinary.com/",
  capabilities: [
    {
      ...capability(
        "asset_read",
        "Find and inspect media",
        "Search, list, and inspect authorized media, folders, tags, metadata, transformations, and derived assets.",
        true,
      ),
      platformCapability: "cloudinary_asset_read",
    },
    {
      ...capability(
        "asset_write",
        "Manage and transform media",
        "Upload, rename, organize, tag, transform, derive, and otherwise manage authorized media.",
        true,
      ),
      platformCapability: "cloudinary_asset_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://asset-management.mcp.cloudinary.com/authorize",
      tokenUrl: "https://asset-management.mcp.cloudinary.com/token",
      userInfoUrl: "https://asset-management.mcp.cloudinary.com/mcp",
      requiredScopes: [...CLOUDINARY_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "CLOUDINARY_MCP_CLIENT_ID",
        label: "Cloudinary MCP OAuth client ID",
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
      name: "cloudinary.read",
      functionName: "cloudinary_read",
      aliases: ["cloudinary.read", "cloudinary_read", "cloudinary_mcp_read"],
      capability: "asset_read",
      platformCapability: "cloudinary_asset_read",
      action: "read",
      approvalRequired: false,
      description:
        "Invoke one live-discovered non-mutating Cloudinary Asset Management MCP tool.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string" },
          arguments: { type: "object" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "cloudinary.write",
      functionName: "cloudinary_write",
      aliases: ["cloudinary.write", "cloudinary_write", "cloudinary_mcp_write"],
      capability: "asset_write",
      platformCapability: "cloudinary_asset_write",
      action: "write",
      approvalRequired: true,
      description:
        "Invoke one live-discovered Cloudinary Asset Management MCP mutation.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string" },
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
      id: "cloudinary_safe",
      label: "Safe",
      description:
        "Verified non-mutating asset tools run directly; mutations and unclassified tools require approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: blocked,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every live-discovered Asset Management MCP tool runs without Relay per-action approval; ownership, provider authority, schemas, bounds, fixed origin, audits, redaction, and limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: blocked,
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_mcp_tools",
      label: "Cloudinary OAuth and live Asset Management MCP capability check",
      requiredScopes: [...CLOUDINARY_SCOPES],
    },
  ],
};
