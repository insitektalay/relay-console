import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("inoreader_get_user_info", "Read user", "Verify the connected Inoreader user."),
  action("inoreader_list_subscriptions", "List subscriptions", "List subscribed feeds."),
  action("inoreader_list_tags", "List tags", "List folders, tags, and system streams."),
  action("inoreader_stream_contents", "Read stream", "Read a bounded page from a feed, folder, tag, or system stream."),
];
const writes = [
  action("inoreader_full_api", "Use full Inoreader API", "Use any documented Reader API GET or POST operation; Safe mode requires approval."),
];

export const INOREADER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "inoreader",
  name: "Inoreader",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.inoreader.com/developers/",
  providerWebsiteUrl: "https://www.inoreader.com/",
  capabilities: [
    {
      ...capability("reader_read", "Read feeds", "Read the connected user, subscriptions, tags, unread counts, and bounded stream contents.", true),
      platformCapability: "inoreader_reader_read",
    },
    {
      ...capability("full_api", "Full Inoreader API", "Subscribe, organize, tag, mark read, and use every OAuth-authorized Reader API operation.", true),
      platformCapability: "inoreader_full_api",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.inoreader.com/oauth2/auth",
      tokenUrl: "https://www.inoreader.com/oauth2/token",
      userInfoUrl: "https://www.inoreader.com/reader/api/0/user-info",
      requiredScopes: ["read", "write"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "INOREADER_CLIENT_ID",
        label: "Inoreader OAuth App ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned App ID configured on Railway.",
      },
      {
        name: "INOREADER_CLIENT_SECRET",
        label: "Inoreader OAuth App Key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned App Key stored only in Railway secret variables.",
      },
    ],
  },
  tools: [
    { name: "inoreader.getUserInfo", functionName: "inoreader_get_user_info", aliases: ["inoreader.getUserInfo", "inoreader_get_user_info"], capability: "reader_read", platformCapability: "inoreader_reader_read", action: "read", approvalRequired: false, description: "Read the authenticated Inoreader user.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "inoreader.listSubscriptions", functionName: "inoreader_list_subscriptions", aliases: ["inoreader.listSubscriptions", "inoreader_list_subscriptions"], capability: "reader_read", platformCapability: "inoreader_reader_read", action: "read", approvalRequired: false, description: "List subscribed feeds.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "inoreader.listTags", functionName: "inoreader_list_tags", aliases: ["inoreader.listTags", "inoreader_list_tags"], capability: "reader_read", platformCapability: "inoreader_reader_read", action: "read", approvalRequired: false, description: "List folders, tags, and system streams.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "inoreader.streamContents", functionName: "inoreader_stream_contents", aliases: ["inoreader.streamContents", "inoreader_stream_contents"], capability: "reader_read", platformCapability: "inoreader_reader_read", action: "read", approvalRequired: false, description: "Read a bounded stream page.", inputSchema: { type: "object", properties: { streamId: { type: "string", maxLength: 500 }, count: { type: "number", minimum: 1, maximum: 100 }, continuation: { type: "string", maxLength: 1000 }, startTime: { type: "number", minimum: 0 }, excludeTarget: { type: "string", maxLength: 500 }, order: { type: "string", enum: ["newest", "oldest"] } }, required: ["streamId"], additionalProperties: false } },
    { name: "inoreader.request", functionName: "inoreader_request", aliases: ["inoreader.request", "inoreader_request", "inoreader_full_api"], capability: "full_api", platformCapability: "inoreader_full_api", action: "admin", approvalRequired: true, description: "Call any documented Reader API GET or POST endpoint at www.inoreader.com. Absolute URLs and credential-bearing fields are rejected.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST"] }, path: { type: "string", pattern: "^/reader/(api/0|atom)" }, query: { type: "object" }, fields: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "inoreader_safe", label: "Safe", description: "Bounded reads run directly; every other Reader API operation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized Reader API operation runs without Relay per-action approval; ownership, fixed origin, bounds, audits, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "user_subscriptions_and_tags", label: "Connected user, token refresh, subscriptions, and tags check" }],
};
