import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("instapaper_verify_account", "Verify account", "Read the connected Instapaper account."),
  action("instapaper_list_bookmarks", "List bookmarks", "List a bounded page of saved bookmarks."),
  action("instapaper_list_folders", "List folders", "List the account's folders."),
  action("instapaper_list_highlights", "List highlights", "List highlights for one bookmark."),
];
const writes = [
  action("instapaper_full_api", "Use full Instapaper API", "Use any published Full API operation under the selected policy."),
];

export const INSTAPAPER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "instapaper",
  name: "Instapaper",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.instapaper.com/developers/v1/full-api",
  providerWebsiteUrl: "https://www.instapaper.com/",
  capabilities: [
    { ...capability("library_read", "Library reads", "Read the connected account, folders, bounded bookmarks, and highlights.", true), platformCapability: "instapaper_library_read" },
    { ...capability("full_api", "Full Instapaper API", "Add, update, move, archive, star, delete, organize, and highlight through every published Full API operation.", true), platformCapability: "instapaper_full_api" },
  ],
  auth: {
    type: "oauth1",
    oauth: {
      authorizationUrl: "https://www.instapaper.com/developers/apps",
      tokenUrl: "https://www.instapaper.com/api/1/oauth/access_token",
      userInfoUrl: "https://www.instapaper.com/api/1/account/verify_credentials",
      requiredScopes: ["full_access"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      { name: "INSTAPAPER_CONSUMER_KEY", label: "Instapaper consumer key", required: true, secret: false, storedIn: "metadata", helpText: "Relay-owned approved application key stored on Railway." },
      { name: "INSTAPAPER_CONSUMER_SECRET", label: "Instapaper consumer secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Relay-owned application secret stored only on Railway." },
    ],
  },
  tools: [
    { name: "instapaper.verifyAccount", functionName: "instapaper_verify_account", aliases: ["instapaper.verifyAccount", "instapaper_verify_account"], capability: "library_read", platformCapability: "instapaper_library_read", action: "read", approvalRequired: false, description: "Read the authenticated Instapaper user.", inputSchema: empty() },
    { name: "instapaper.listBookmarks", functionName: "instapaper_list_bookmarks", aliases: ["instapaper.listBookmarks", "instapaper_list_bookmarks"], capability: "library_read", platformCapability: "instapaper_library_read", action: "read", approvalRequired: false, description: "List up to 100 bookmarks from a folder or tag.", inputSchema: { type: "object", properties: { limit: { type: "number", minimum: 1, maximum: 100 }, folderId: { type: "string", maxLength: 100 }, tag: { type: "string", maxLength: 200 } }, additionalProperties: false } },
    { name: "instapaper.listFolders", functionName: "instapaper_list_folders", aliases: ["instapaper.listFolders", "instapaper_list_folders"], capability: "library_read", platformCapability: "instapaper_library_read", action: "read", approvalRequired: false, description: "List user-created folders.", inputSchema: empty() },
    { name: "instapaper.listHighlights", functionName: "instapaper_list_highlights", aliases: ["instapaper.listHighlights", "instapaper_list_highlights"], capability: "library_read", platformCapability: "instapaper_library_read", action: "read", approvalRequired: false, description: "List highlights for one bookmark.", inputSchema: { type: "object", properties: { bookmarkId: { type: "number", minimum: 1 } }, required: ["bookmarkId"], additionalProperties: false } },
    { name: "instapaper.request", functionName: "instapaper_request", aliases: ["instapaper.request", "instapaper_request", "instapaper_full_api"], capability: "full_api", platformCapability: "instapaper_full_api", action: "admin", approvalRequired: true, description: "Call any published POST /api/1 or /api/1.1 Full API endpoint at www.instapaper.com. Safe mode requires approval.", inputSchema: { type: "object", properties: { path: { type: "string", pattern: "^/api/1(?:\\.1)?/" }, fields: { type: "object" }, approvalId: { type: "string" } }, required: ["path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "instapaper_safe", label: "Safe", description: "Bounded library reads run directly; every mutation or raw Full API operation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected token-authorized Full API operation runs without Relay per-action approval; ownership, fixed origin, provider rules, bounds, and audits still apply.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "verify_credentials", label: "OAuth token and account check" }],
};

function empty() { return { type: "object", properties: {}, additionalProperties: false }; }
