import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { FIREFLIES_READ_TOOLS, FIREFLIES_WRITE_TOOLS } from "./fireflies-ai-mcp.adapter";

const reads = [action("fireflies_mcp_read", "Use read tools", "Use one documented Fireflies MCP read tool with bounded arguments.")];
const writes = [action("fireflies_mcp_write", "Use action tools", "Use one documented Fireflies meeting-management or soundbite action; Safe mode requires approval.")];

export const FIREFLIES_AI_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "fireflies-ai",
  name: "Fireflies.ai",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.fireflies.ai/getting-started/mcp-configuration",
  providerWebsiteUrl: "https://fireflies.ai/",
  capabilities: [
    { ...capability("meeting_knowledge", "Read meeting knowledge", "Search meetings and read transcripts, summaries, active meetings, analytics, channels, soundbites, users, contacts, and automation logs.", true), platformCapability: "fireflies_meeting_knowledge" },
    { ...capability("meeting_management", "Manage meetings and soundbites", "Share or revoke meeting access, rename or move meetings, and create soundbites.", true), platformCapability: "fireflies_meeting_management" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.fireflies.ai/authorize",
      tokenUrl: "https://api.fireflies.ai/token",
      revocationUrl: "https://api.fireflies.ai/revoke",
      userInfoUrl: "https://api.fireflies.ai/mcp",
      requiredScopes: ["profile", "email"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [{
      name: "FIREFLIES_CLIENT_ID",
      label: "Fireflies OAuth client ID",
      required: true,
      secret: false,
      storedIn: "metadata",
      helpText: "Relay's dynamically registered public PKCE client ID, configured on Railway.",
    }],
  },
  tools: [
    {
      name: "fireflies.read",
      functionName: "fireflies_read",
      aliases: ["fireflies.read", "fireflies_read", "fireflies_mcp_read"],
      capability: "meeting_knowledge",
      platformCapability: "fireflies_meeting_knowledge",
      action: "read",
      approvalRequired: false,
      description: "Invoke one exact documented Fireflies MCP read tool after live schema discovery.",
      inputSchema: { type: "object", properties: { toolName: { type: "string", enum: [...FIREFLIES_READ_TOOLS] }, arguments: { type: "object" } }, required: ["toolName", "arguments"], additionalProperties: false },
    },
    {
      name: "fireflies.write",
      functionName: "fireflies_write",
      aliases: ["fireflies.write", "fireflies_write", "fireflies_mcp_write"],
      capability: "meeting_management",
      platformCapability: "fireflies_meeting_management",
      action: "write",
      approvalRequired: true,
      description: "Invoke one exact documented Fireflies meeting-management or soundbite tool after live schema discovery.",
      inputSchema: { type: "object", properties: { toolName: { type: "string", enum: [...FIREFLIES_WRITE_TOOLS] }, arguments: { type: "object" }, approvalId: { type: "string" } }, required: ["toolName", "arguments"], additionalProperties: false },
    },
  ],
  approvalProfiles: [
    { id: "fireflies_ai_safe", label: "Safe", description: "Meeting, transcript, summary, analytics, channel, soundbite, user, and automation reads run directly; sharing, revoking access, renaming, moving, and soundbite creation require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized Fireflies MCP operation runs without Relay per-action approval; ownership, provider permissions, exact tool allowlists, live schemas, bounds, audits, redaction, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "oauth_and_mcp_tools", label: "Fireflies OAuth and documented MCP capability check", requiredScopes: ["profile", "email"] }],
};
