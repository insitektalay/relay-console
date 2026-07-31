import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("vidyard_list_accounts", "List accounts", "List accounts visible to the configured token."),
  action("vidyard_list_players", "List players", "List one bounded page of players in the configured folder."),
  action("vidyard_get_player", "Read player", "Read one player by ID or UUID."),
  action("vidyard_list_videos", "List videos", "List one bounded page of videos in the configured folder."),
  action("vidyard_get_video", "Read video", "Read one video by ID."),
];
const full = [action("vidyard_full_api", "Use full Dashboard API", "Use any current documented Dashboard API operation; Safe mode requires approval.")];

export const VIDYARD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vidyard", name: "Vidyard", connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.vidyard.com/", providerWebsiteUrl: "https://www.vidyard.com/",
  capabilities: [
    { ...capability("video_read", "Read video library", "List and inspect permitted players, videos, captions, tags, accounts, and related metadata.", true), platformCapability: "vidyard_video_read" },
    { ...capability("video_write", "Maintain video content", "Create, update, duplicate, publish, organize, and delete permitted video resources.", true), platformCapability: "vidyard_video_write" },
    { ...capability("analytics", "Use analytics and events", "Read permitted analytics events and manage analytics subscriptions and player webhooks.", true), platformCapability: "vidyard_analytics" },
    { ...capability("administration", "Administer Vidyard", "Use all other documented Dashboard API resources permitted by the token's folder and role.", true), platformCapability: "vidyard_administration" },
  ],
  auth: { type: "api_key", credentialSchema: [{ name: "VIDYARD_API_TOKEN", label: "Vidyard API token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Copy a dedicated role-bound token under Admin > API Tokens in the intended Vidyard folder." }] },
  tools: [
    { name: "vidyard.listAccounts", functionName: "vidyard_list_accounts", aliases: ["vidyard.listAccounts", "vidyard_list_accounts"], capability: "video_read", platformCapability: "vidyard_video_read", action: "read", approvalRequired: false, description: "List accounts visible to the configured token.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "vidyard.listPlayers", functionName: "vidyard_list_players", aliases: ["vidyard.listPlayers", "vidyard_list_players"], capability: "video_read", platformCapability: "vidyard_video_read", action: "read", approvalRequired: false, description: "List a bounded page of players.", inputSchema: { type: "object", properties: { page: { type: "number", minimum: 1, maximum: 10000 }, perPage: { type: "number", minimum: 1, maximum: 100 } }, additionalProperties: false } },
    { name: "vidyard.getPlayer", functionName: "vidyard_get_player", aliases: ["vidyard.getPlayer", "vidyard_get_player"], capability: "video_read", platformCapability: "vidyard_video_read", action: "read", approvalRequired: false, description: "Read one player by ID or UUID.", inputSchema: { type: "object", properties: { playerId: { type: "string", maxLength: 200 }, byUuid: { type: "boolean" } }, required: ["playerId"], additionalProperties: false } },
    { name: "vidyard.listVideos", functionName: "vidyard_list_videos", aliases: ["vidyard.listVideos", "vidyard_list_videos"], capability: "video_read", platformCapability: "vidyard_video_read", action: "read", approvalRequired: false, description: "List a bounded page of videos.", inputSchema: { type: "object", properties: { page: { type: "number", minimum: 1, maximum: 10000 }, perPage: { type: "number", minimum: 1, maximum: 100 } }, additionalProperties: false } },
    { name: "vidyard.getVideo", functionName: "vidyard_get_video", aliases: ["vidyard.getVideo", "vidyard_get_video"], capability: "video_read", platformCapability: "vidyard_video_read", action: "read", approvalRequired: false, description: "Read one video by ID.", inputSchema: { type: "object", properties: { videoId: { type: "string", maxLength: 200 } }, required: ["videoId"], additionalProperties: false } },
    { name: "vidyard.request", functionName: "vidyard_request", aliases: ["vidyard.request", "vidyard_request", "vidyard_full_api"], capability: "administration", platformCapability: "vidyard_administration", action: "admin", approvalRequired: true, description: "Call an exact method and Dashboard v1 resource path on the fixed official origin.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "vidyard_safe", label: "Safe", description: "Bounded account, player, and video reads run directly; every other Dashboard API operation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: full, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected token-authorized Dashboard API operation runs without Relay per-action approval; ownership, fixed origin, bounds, audits, redaction, token role and folder permissions, and provider limits still apply.", defaultSelected: false, allowedActions: [...reads, ...full], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "current-role", label: "Vidyard token and role validation" }],
};
