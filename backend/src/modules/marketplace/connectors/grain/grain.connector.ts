import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { GRAIN_READ_TOOLS, GRAIN_WRITE_TOOLS } from "./grain-mcp.adapter";

const reads = [
  action(
    "grain_mcp_read",
    "Use Grain read tools",
    "Use one exact documented Grain identity, meeting, transcript, note, search, coaching, or deal read tool.",
  ),
];
const writes = [
  action(
    "grain_mcp_write",
    "Create and organize Grain content",
    "Create clips, tag meetings, and create or share playlists; Safe mode requires approval.",
  ),
];

export const GRAIN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "grain",
  name: "Grain",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.grain.com/mcp",
  providerWebsiteUrl: "https://grain.com/",
  capabilities: [
    {
      ...capability(
        "meeting_knowledge",
        "Read meeting knowledge",
        "Search meetings and read transcripts, AI notes, action items, private notes, people, companies, and workspace users.",
        true,
      ),
      platformCapability: "grain_meeting_knowledge",
    },
    {
      ...capability(
        "sales_intelligence",
        "Read coaching and deal intelligence",
        "Read plan-authorized coaching feedback, scorecards, and HubSpot-linked deal intelligence.",
        true,
      ),
      platformCapability: "grain_sales_intelligence",
    },
    {
      ...capability(
        "content_management",
        "Create clips and organize meetings",
        "Create clips, add or remove meeting tags, and create, populate, or share playlists.",
        true,
      ),
      platformCapability: "grain_content_management",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://grain.com/_/public-api/oauth2/authorize",
      tokenUrl: "https://api.grain.com/_/public-api/oauth2/token",
      userInfoUrl: "https://api.grain.com/_/mcp",
      requiredScopes: [],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GRAIN_MCP_CLIENT_ID",
        label: "Grain MCP OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay's dynamically registered public PKCE client ID, configured on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "grain.read",
      functionName: "grain_read",
      aliases: ["grain.read", "grain_read", "grain_mcp_read"],
      capability: "meeting_knowledge",
      platformCapability: "grain_meeting_knowledge",
      action: "read",
      approvalRequired: false,
      description: "Invoke one exact documented Grain MCP read tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...GRAIN_READ_TOOLS] },
          arguments: { type: "object" },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "grain.write",
      functionName: "grain_write",
      aliases: ["grain.write", "grain_write", "grain_mcp_write"],
      capability: "content_management",
      platformCapability: "grain_content_management",
      action: "write",
      approvalRequired: true,
      description: "Invoke one exact documented Grain clip, tag, or playlist tool after live schema discovery.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...GRAIN_WRITE_TOOLS] },
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
      id: "grain_safe",
      label: "Safe",
      description: "Meeting, transcript, note, search, coaching, and deal reads run directly; clip, tag, and playlist changes require approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: "Every selected OAuth-authorized Grain MCP operation runs without Relay per-action approval; ownership, provider permissions, plan limits, exact tool allowlists, live schemas, bounds, audits, and redaction still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "oauth_and_mcp_tools", label: "Grain OAuth and exact 22-tool MCP capability check" },
  ],
};
