import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("vimeo_get_me", "Read account", "Read the connected Vimeo account."),
  action("vimeo_list_videos", "List videos", "List a bounded page of videos owned by the connected account."),
  action("vimeo_get_video", "Read video", "Read one exact video by ID."),
  action("vimeo_list_folders", "List folders", "List a bounded page of project folders."),
  action("vimeo_get_folder", "Read folder", "Read one exact project folder by ID."),
];
const full = [
  action("vimeo_full_api", "Use full Vimeo API", "Use any current documented Vimeo API operation; Safe mode requires approval."),
];

export const VIMEO_SCOPES = [
  "public", "private", "create", "edit", "delete", "interact", "stats",
  "upload", "video_files", "purchased", "promo_codes",
] as const;

export const VIMEO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vimeo",
  name: "Vimeo",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.vimeo.com/api/reference",
  providerWebsiteUrl: "https://vimeo.com/",
  capabilities: [
    { ...capability("video_read", "Read video library", "Read the connected account, videos, folders, captions, comments, showcases, channels, groups, and related metadata.", true), platformCapability: "vimeo_video_read" },
    { ...capability("video_write", "Manage video content", "Upload, edit, organize, publish, interact with, and delete OAuth-authorized Vimeo resources.", true), platformCapability: "vimeo_video_write" },
    { ...capability("analytics", "Use statistics", "Read OAuth-authorized video statistics and related reporting resources.", true), platformCapability: "vimeo_analytics" },
    { ...capability("administration", "Use the complete Vimeo API", "Use every current documented API operation permitted by the connected account, plan, app approval, and granted scopes.", true), platformCapability: "vimeo_administration" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.vimeo.com/oauth/authorize",
      tokenUrl: "https://api.vimeo.com/oauth/access_token",
      userInfoUrl: "https://api.vimeo.com/me",
      requiredScopes: [...VIMEO_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      { name: "VIMEO_CLIENT_ID", label: "Vimeo OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay-owned Vimeo client ID configured on Railway." },
      { name: "VIMEO_CLIENT_SECRET", label: "Vimeo OAuth client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Relay-owned Vimeo client secret stored only in Railway secret variables." },
    ],
  },
  tools: [
    { name: "vimeo.getMe", functionName: "vimeo_get_me", aliases: ["vimeo.getMe", "vimeo_get_me"], capability: "video_read", platformCapability: "vimeo_video_read", action: "read", approvalRequired: false, description: "Read the connected Vimeo account.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "vimeo.listVideos", functionName: "vimeo_list_videos", aliases: ["vimeo.listVideos", "vimeo_list_videos"], capability: "video_read", platformCapability: "vimeo_video_read", action: "read", approvalRequired: false, description: "List a bounded page of videos owned by the connected account.", inputSchema: { type: "object", properties: { page: { type: "number", minimum: 1, maximum: 10000 }, perPage: { type: "number", minimum: 1, maximum: 100 }, query: { type: "string", maxLength: 500 }, sort: { type: "string", enum: ["date", "alphabetical", "plays", "likes", "comments", "duration", "modified_time"] }, direction: { type: "string", enum: ["asc", "desc"] } }, additionalProperties: false } },
    { name: "vimeo.getVideo", functionName: "vimeo_get_video", aliases: ["vimeo.getVideo", "vimeo_get_video"], capability: "video_read", platformCapability: "vimeo_video_read", action: "read", approvalRequired: false, description: "Read one exact video by ID.", inputSchema: { type: "object", properties: { videoId: { type: "string", pattern: "^[0-9]+$", maxLength: 30 } }, required: ["videoId"], additionalProperties: false } },
    { name: "vimeo.listFolders", functionName: "vimeo_list_folders", aliases: ["vimeo.listFolders", "vimeo_list_folders"], capability: "video_read", platformCapability: "vimeo_video_read", action: "read", approvalRequired: false, description: "List a bounded page of project folders.", inputSchema: { type: "object", properties: { page: { type: "number", minimum: 1, maximum: 10000 }, perPage: { type: "number", minimum: 1, maximum: 100 }, query: { type: "string", maxLength: 500 } }, additionalProperties: false } },
    { name: "vimeo.getFolder", functionName: "vimeo_get_folder", aliases: ["vimeo.getFolder", "vimeo_get_folder"], capability: "video_read", platformCapability: "vimeo_video_read", action: "read", approvalRequired: false, description: "Read one exact project folder by ID.", inputSchema: { type: "object", properties: { folderId: { type: "string", pattern: "^[0-9]+$", maxLength: 30 } }, required: ["folderId"], additionalProperties: false } },
    { name: "vimeo.request", functionName: "vimeo_request", aliases: ["vimeo.request", "vimeo_request", "vimeo_full_api"], capability: "administration", platformCapability: "vimeo_administration", action: "admin", approvalRequired: true, description: "Call an exact current documented API method and resource path on the fixed api.vimeo.com origin.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "vimeo_safe", label: "Safe", description: "Bounded account, video, and folder reads run directly; every other Vimeo API operation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: full, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized Vimeo API operation runs without Relay per-action approval; fixed origin, request bounds, audits, redaction, account ownership, provider scopes, plan limits, app review, and Vimeo enforcement still apply.", defaultSelected: false, allowedActions: [...reads, ...full], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "connected_account", label: "Vimeo OAuth token and connected-account validation" }],
};
