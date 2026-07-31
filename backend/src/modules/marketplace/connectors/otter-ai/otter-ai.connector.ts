import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const actions = [
  action("otter_get_user_info", "Read user profile", "Read the connected user's name and email."),
  action("otter_search", "Search meetings", "Search authorized Otter meetings with a bounded query."),
  action("otter_fetch", "Fetch transcript", "Fetch the transcript for one authorized Otter conversation."),
];

export const OTTER_AI_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "otter-ai", name: "Otter.ai", connectorType: "native_clawchat",
  providerDocsUrl: "https://help.otter.ai/hc/en-us/articles/35287607569687-Otter-MCP-Server", providerWebsiteUrl: "https://otter.ai/",
  capabilities: [
    { ...capability("identity", "Identify the connected user", "Read the name and email of the OAuth-authorized Otter user.", true), platformCapability: "otter_identity" },
    { ...capability("meeting_search", "Search meetings", "Search authorized Otter meetings and return bounded summaries and source references.", true), platformCapability: "otter_meeting_search" },
    { ...capability("transcript_read", "Read transcripts", "Fetch a full transcript for an authorized meeting or conversation.", true), platformCapability: "otter_transcript_read" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: { authorizationUrl: "https://otter.ai/oauth2/authorize", tokenUrl: "https://otter.ai/oauth/token", revocationUrl: "https://otter.ai/oauth/revoke_token", userInfoUrl: "https://mcp.otter.ai/mcp", requiredScopes: ["profile:read", "conversations:read"], optionalScopes: [], pkce: true, supportsRefresh: true },
    credentialSchema: [{ name: "OTTER_CLIENT_ID", label: "Otter OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay's dynamically registered public PKCE client ID, configured on Railway." }],
  },
  tools: [
    { name: "otter.getUserInfo", functionName: "otter_get_user_info", aliases: ["otter.getUserInfo", "otter_get_user_info"], capability: "identity", platformCapability: "otter_identity", action: "read", approvalRequired: false, description: "Read the connected Otter user's name and email.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "otter.search", functionName: "otter_search", aliases: ["otter.search", "otter_search"], capability: "meeting_search", platformCapability: "otter_meeting_search", action: "read", approvalRequired: false, description: "Search authorized Otter meetings.", inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 10000 } }, required: ["query"], additionalProperties: false } },
    { name: "otter.fetch", functionName: "otter_fetch", aliases: ["otter.fetch", "otter_fetch"], capability: "transcript_read", platformCapability: "otter_transcript_read", action: "read", approvalRequired: false, description: "Fetch one authorized Otter meeting transcript.", inputSchema: { type: "object", properties: { id: { type: "string", minLength: 1, maxLength: 10000 } }, required: ["id"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "otter_ai_safe", label: "Safe", description: "Identity, bounded meeting search, and transcript retrieval run directly; Otter's hosted MCP exposes no mutation tools.", defaultSelected: true, allowedActions: actions, approvalRequiredActions: [], blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized Otter MCP operation runs without Relay per-action approval; ownership, OAuth scopes, meeting sharing, exact tool allowlists, live schemas, bounds, audits, redaction, and provider limits still apply.", defaultSelected: false, allowedActions: actions, approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "oauth_and_mcp_tools", label: "Otter OAuth and documented MCP capability check", requiredScopes: ["profile:read", "conversations:read"] }],
};
