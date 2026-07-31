import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const LINE_SCOPES = ["profile", "openid"];
const reads = [
  action("line_profile_get", "Read connected profile", "Read the useful public profile fields for the OIDC-bound LINE Login user."),
];
const blocks = [
  blocked("line_extra_identity", "Block extra identity scopes", "Email, friendship status, social graph and add-friend prompts are not exposed."),
  blocked("line_messaging_authority", "Block Messaging API authority", "Channel access tokens, bot profiles, webhooks, messages, replies, push, multicast, narrowcast, broadcast, rich menus and audiences are not exposed."),
  blocked("line_writes_raw", "Block writes and raw access", "All writes, exports, arbitrary endpoints and raw provider tools are blocked."),
];

export const LINE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "line", name: "LINE", connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.line.biz/en/docs/line-login/integrate-line-login/",
  providerWebsiteUrl: "https://line.me/",
  capabilities: [
    { ...capability("profile_read", "Read connected profile", "Read the bound LINE Login user's useful public profile fields.", true), platformCapability: "profile_read" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://access.line.me/oauth2/v2.1/authorize",
      tokenUrl: "https://api.line.me/oauth2/v2.1/token",
      userInfoUrl: "https://api.line.me/v2/profile",
      requiredScopes: LINE_SCOPES, optionalScopes: [], pkce: true, supportsRefresh: true,
    },
    credentialSchema: [
      { name: "LINE_CLIENT_ID", label: "LINE Login channel ID", required: true, secret: false, storedIn: "metadata", helpText: "Railway-held production LINE Login channel ID." },
      { name: "LINE_CLIENT_SECRET", label: "LINE Login channel secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Railway-encrypted channel secret; never sent to Swift or agents." },
    ],
  },
  tools: [
    { name: "relay_line_get_profile", functionName: "relay_line_get_profile", aliases: ["line_profile_get"], capability: "profile_read", platformCapability: "profile_read", action: "read", approvalRequired: false, description: "Read the OIDC-bound LINE Login profile.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "line_read_only", label: "Read only", description: "Only the bound LINE Login profile read is enabled.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: [], blockedActions: blocks },
    { id: "line_no_access", label: "No access", description: "All LINE actions are blocked.", defaultSelected: false, allowedActions: [], approvalRequiredActions: [], blockedActions: [...blocks, ...reads] },
  ],
  healthChecks: [{ id: "bound_profile", label: "OIDC-bound LINE Login profile and refresh lifecycle", requiredScopes: LINE_SCOPES }],
};
