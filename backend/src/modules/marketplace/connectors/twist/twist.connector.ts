import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("twist_user_get", "Read connected user", "Verify the OAuth-authorized Twist user."),
  action("twist_workspaces_list", "List workspaces", "List at most twenty Twist workspaces."),
  action("twist_channels_list", "List workspace channels", "List at most fifty channels in one workspace."),
  action("twist_inbox_threads_list", "List inbox threads", "List at most twenty recent inbox threads in one workspace."),
  action("twist_thread_comments_get", "Read thread with comments", "Read one explicit thread and at most thirty recent comments."),
];

const blocks = [
  blocked("twist_mutations", "Block mutations", "Thread, comment, channel, workspace, message, reaction, notification and administration mutations are not exposed."),
  blocked("twist_sensitive_reads", "Block sensitive reads", "Direct messages, conversations, attachments, notifications, groups and broad member data are not exposed."),
  blocked("twist_broad_raw", "Block broad and raw access", "Global search, cursors, pagination, bulk export, webhooks, bots, update integrations and raw API access are not exposed."),
];

export const TWIST_REQUIRED_SCOPES = [
  "user:read", "workspaces:read", "channels:read", "threads:read", "comments:read",
];

export const TWIST_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "twist",
  name: "Twist",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.twist.com/v3/",
  providerWebsiteUrl: "https://twist.com/",
  capabilities: [
    { ...capability("user_read", "Read connected user", "Verify the connected Twist user.", true), platformCapability: "user_read" },
    { ...capability("workspace_read", "List workspaces", "List at most twenty workspaces.", true), platformCapability: "workspace_read" },
    { ...capability("channel_read", "List channels", "List at most fifty channels in one workspace.", true), platformCapability: "channel_read" },
    { ...capability("inbox_thread_read", "List inbox threads", "List at most twenty recent inbox threads.", true), platformCapability: "inbox_thread_read" },
    { ...capability("thread_comment_read", "Read thread comments", "Read one thread with at most thirty recent comments.", true), platformCapability: "thread_comment_read" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://twist.com/oauth/authorize",
      tokenUrl: "https://twist.com/oauth/access_token",
      userInfoUrl: "https://api.twist.com/api/v3/users/get_session_user",
      requiredScopes: TWIST_REQUIRED_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      { name: "TWIST_CLIENT_ID", label: "Twist client ID", required: true, secret: false, storedIn: "metadata", helpText: "Railway-held General Integration client ID." },
      { name: "TWIST_CLIENT_SECRET", label: "Twist client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Railway-held confidential secret; never entered in RelayConsoleSwift." },
    ],
  },
  tools: [
    { name: "relay_twist_get_user", functionName: "relay_twist_get_user", aliases: ["twist_user_get"], capability: "user_read", platformCapability: "user_read", action: "read", approvalRequired: false, description: "Read the connected Twist user.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "relay_twist_list_workspaces", functionName: "relay_twist_list_workspaces", aliases: ["twist_workspaces_list"], capability: "workspace_read", platformCapability: "workspace_read", action: "read", approvalRequired: false, description: "List at most twenty Twist workspaces.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 20 } }, additionalProperties: false } },
    { name: "relay_twist_list_channels", functionName: "relay_twist_list_channels", aliases: ["twist_channels_list"], capability: "channel_read", platformCapability: "channel_read", action: "read", approvalRequired: false, description: "List at most fifty channels in one workspace.", inputSchema: { type: "object", properties: { workspaceId: { type: "string", pattern: "^[0-9]+$", maxLength: 64 }, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["workspaceId"], additionalProperties: false } },
    { name: "relay_twist_list_inbox_threads", functionName: "relay_twist_list_inbox_threads", aliases: ["twist_inbox_threads_list"], capability: "inbox_thread_read", platformCapability: "inbox_thread_read", action: "read", approvalRequired: false, description: "List at most twenty recent inbox threads in one workspace.", inputSchema: { type: "object", properties: { workspaceId: { type: "string", pattern: "^[0-9]+$", maxLength: 64 }, limit: { type: "integer", minimum: 1, maximum: 20 } }, required: ["workspaceId"], additionalProperties: false } },
    { name: "relay_twist_get_thread_with_comments", functionName: "relay_twist_get_thread_with_comments", aliases: ["twist_thread_comments_get"], capability: "thread_comment_read", platformCapability: "thread_comment_read", action: "read", approvalRequired: false, description: "Read one explicit thread and at most thirty recent comments.", inputSchema: { type: "object", properties: { threadId: { type: "string", pattern: "^[0-9]+$", maxLength: 64 }, commentLimit: { type: "integer", minimum: 1, maximum: 30 } }, required: ["threadId"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "twist_read_only", label: "Read only", description: "Only five fixed bounded Twist reads are enabled.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: [], blockedActions: blocks },
    { id: "twist_no_access", label: "No access", description: "All Twist actions are blocked.", defaultSelected: false, allowedActions: [], approvalRequiredActions: [], blockedActions: [...blocks, ...reads] },
  ],
  healthChecks: [{ id: "connected_user", label: "Connected Twist user", requiredScopes: TWIST_REQUIRED_SCOPES }],
};
