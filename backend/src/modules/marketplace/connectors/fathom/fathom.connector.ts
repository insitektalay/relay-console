import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { FATHOM_READ_TOOLS, FATHOM_WRITE_TOOLS } from "./fathom-mcp.adapter";

const reads = [action("fathom_mcp_read", "Use meeting read tools", "Use one documented Fathom MCP meeting, transcript, summary, team, or member read tool.")];
const writes = [action("fathom_mcp_write", "Manage webhooks", "Create or delete a Fathom webhook; Safe mode requires approval.")];

export const FATHOM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "fathom", name: "Fathom", connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.fathom.ai/mcp-docs", providerWebsiteUrl: "https://www.fathom.ai/",
  capabilities: [
    { ...capability("meeting_knowledge", "Read meeting knowledge", "List meetings, retrieve summaries and speaker-attributed transcripts, and inspect teams and team members.", true), platformCapability: "fathom_meeting_knowledge" },
    { ...capability("webhook_management", "Manage meeting webhooks", "Create or delete post-meeting webhooks using public HTTPS destinations.", true), platformCapability: "fathom_webhook_management" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: { authorizationUrl: "https://fathom.video/mcp/oauth/authorize", tokenUrl: "https://api.fathom.ai/mcp/oauth/token", userInfoUrl: "https://api.fathom.ai/mcp", requiredScopes: ["mcp"], optionalScopes: [], pkce: true, supportsRefresh: false },
    credentialSchema: [{ name: "FATHOM_MCP_CLIENT_ID", label: "Fathom MCP OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay's dynamically registered public PKCE client ID, configured on Railway." }],
  },
  tools: [
    { name: "fathom.read", functionName: "fathom_read", aliases: ["fathom.read", "fathom_read", "fathom_mcp_read"], capability: "meeting_knowledge", platformCapability: "fathom_meeting_knowledge", action: "read", approvalRequired: false, description: "Invoke one exact documented Fathom MCP read tool after live schema discovery.", inputSchema: { type: "object", properties: { toolName: { type: "string", enum: [...FATHOM_READ_TOOLS] }, arguments: { type: "object" } }, required: ["toolName", "arguments"], additionalProperties: false } },
    { name: "fathom.write", functionName: "fathom_write", aliases: ["fathom.write", "fathom_write", "fathom_mcp_write"], capability: "webhook_management", platformCapability: "fathom_webhook_management", action: "write", approvalRequired: true, description: "Invoke one exact documented Fathom webhook tool after live schema discovery.", inputSchema: { type: "object", properties: { toolName: { type: "string", enum: [...FATHOM_WRITE_TOOLS] }, arguments: { type: "object" }, approvalId: { type: "string" } }, required: ["toolName", "arguments"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "fathom_safe", label: "Safe", description: "Meeting, transcript, summary, team, and member reads run directly; webhook creation and deletion require approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized Fathom MCP operation runs without Relay per-action approval; ownership, provider permissions, exact tool allowlists, live schemas, public-HTTPS webhook boundaries, bounds, audits, redaction, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "oauth_and_mcp_tools", label: "Fathom OAuth and documented MCP capability check", requiredScopes: ["mcp"] }],
};
