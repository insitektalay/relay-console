import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("wistia_get_account", "Read account", "Read the connected Wistia account summary."),
  action("wistia_list_media", "List media", "List a bounded page of media in the connected account."),
  action("wistia_get_media", "Read media", "Read one exact media item by hashed ID."),
  action("wistia_list_folders", "List folders", "List a bounded page of folders."),
  action("wistia_get_folder", "Read folder", "Read one exact folder by hashed ID."),
  action("wistia_search", "Search library", "Search a bounded set of media, folders, channels, webinars, and transcript matches."),
];
const full = [action("wistia_full_api", "Use full Wistia API", "Use any current documented Wistia JSON API operation; Safe mode requires approval.")];
export const WISTIA_SCOPES = ["all:all"] as const;

export const WISTIA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "wistia",
  name: "Wistia",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.wistia.com/reference/getting-started-with-the-data-api",
  providerWebsiteUrl: "https://wistia.com/",
  capabilities: [
    { ...capability("media_read", "Read video library", "Read the connected account, media, folders, customizations, captions, tags, channels, webinars, and search results.", true), platformCapability: "wistia_media_read" },
    { ...capability("media_write", "Manage video content", "Upload or import, edit, organize, publish, customize, and delete Wistia resources permitted by the connected account.", true), platformCapability: "wistia_media_write" },
    { ...capability("analytics", "Use engagement analytics", "Read account-authorized media, audience, visitor, event, and engagement statistics.", true), platformCapability: "wistia_analytics" },
    { ...capability("administration", "Use the complete Wistia API", "Use every current documented JSON API operation permitted by the connected account, plan, features, and OAuth application.", true), platformCapability: "wistia_administration" },
  ],
  auth: { type: "oauth2_authorization_code", oauth: { authorizationUrl: "https://app.wistia.com/oauth/authorize", tokenUrl: "https://api.wistia.com/oauth/token", userInfoUrl: "https://api.wistia.com/modern/account", requiredScopes: [...WISTIA_SCOPES], optionalScopes: [], pkce: false, supportsRefresh: true }, credentialSchema: [
    { name: "WISTIA_CLIENT_ID", label: "Wistia OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Relay-owned Wistia client ID configured on Railway." },
    { name: "WISTIA_CLIENT_SECRET", label: "Wistia OAuth client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Relay-owned Wistia client secret stored only in Railway secret variables." },
  ] },
  tools: [
    { name: "wistia.getAccount", functionName: "wistia_get_account", aliases: ["wistia.getAccount", "wistia_get_account"], capability: "media_read", platformCapability: "wistia_media_read", action: "read", approvalRequired: false, description: "Read the connected Wistia account summary.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "wistia.listMedia", functionName: "wistia_list_media", aliases: ["wistia.listMedia", "wistia_list_media"], capability: "media_read", platformCapability: "wistia_media_read", action: "read", approvalRequired: false, description: "List a bounded page of media.", inputSchema: { type: "object", properties: { page: { type: "number", minimum: 1, maximum: 10000 }, perPage: { type: "number", minimum: 1, maximum: 100 }, folderId: { type: "string", maxLength: 100 }, name: { type: "string", maxLength: 500 }, type: { type: "string", maxLength: 100 } }, additionalProperties: false } },
    { name: "wistia.getMedia", functionName: "wistia_get_media", aliases: ["wistia.getMedia", "wistia_get_media"], capability: "media_read", platformCapability: "wistia_media_read", action: "read", approvalRequired: false, description: "Read one exact media item by hashed ID.", inputSchema: { type: "object", properties: { mediaId: { type: "string", pattern: "^[A-Za-z0-9_-]+$", maxLength: 100 } }, required: ["mediaId"], additionalProperties: false } },
    { name: "wistia.listFolders", functionName: "wistia_list_folders", aliases: ["wistia.listFolders", "wistia_list_folders"], capability: "media_read", platformCapability: "wistia_media_read", action: "read", approvalRequired: false, description: "List a bounded page of folders.", inputSchema: { type: "object", properties: { page: { type: "number", minimum: 1, maximum: 10000 }, perPage: { type: "number", minimum: 1, maximum: 100 } }, additionalProperties: false } },
    { name: "wistia.getFolder", functionName: "wistia_get_folder", aliases: ["wistia.getFolder", "wistia_get_folder"], capability: "media_read", platformCapability: "wistia_media_read", action: "read", approvalRequired: false, description: "Read one exact folder by hashed ID.", inputSchema: { type: "object", properties: { folderId: { type: "string", pattern: "^[A-Za-z0-9_-]+$", maxLength: 100 } }, required: ["folderId"], additionalProperties: false } },
    { name: "wistia.search", functionName: "wistia_search", aliases: ["wistia.search", "wistia_search"], capability: "media_read", platformCapability: "wistia_media_read", action: "read", approvalRequired: false, description: "Search a bounded set of Wistia library results.", inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 500 }, perPage: { type: "number", minimum: 1, maximum: 100 }, page: { type: "number", minimum: 1, maximum: 10000 } }, required: ["query"], additionalProperties: false } },
    { name: "wistia.request", functionName: "wistia_request", aliases: ["wistia.request", "wistia_request", "wistia_full_api"], capability: "administration", platformCapability: "wistia_administration", action: "admin", approvalRequired: true, description: "Call an exact current documented Wistia JSON API method and resource path on a fixed Wistia API origin.", inputSchema: { type: "object", properties: { origin: { type: "string", enum: ["api", "upload"] }, method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", pattern: "^/" }, query: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "wistia_safe", label: "Safe", description: "Bounded account, media, folder, and search reads run directly; every other Wistia operation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: full, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected OAuth-authorized Wistia JSON API operation runs without Relay per-action approval; fixed origins, request bounds, audits, redaction, account ownership, provider permissions, plan limits, and Wistia enforcement still apply.", defaultSelected: false, allowedActions: [...reads, ...full], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "connected_account", label: "Wistia OAuth token and connected-account validation" }],
};
