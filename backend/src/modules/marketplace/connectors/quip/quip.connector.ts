import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const QUIP_SCOPES = ["USER_READ", "USER_WRITE", "USER_MANAGE"] as const;
const read = action("quip_read", "Read Quip", "Read user-authorized Quip documents, spreadsheets, messages, folders, users, and metadata.");
const write = action("quip_write", "Change Quip", "Create, edit, copy, export, message, upload, archive, or delete authorized Quip resources.");
const manage = action("quip_manage", "Manage Quip sharing", "Manage provider-authorized thread and folder access, link sharing, locks, and membership.");
const requestSchema = { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string", minLength: 1, maxLength: 2000 }, query: { type: "object" }, form: { type: "object" }, json: { type: "object" }, approvalId: { type: "string" } }, required: ["method", "path"], additionalProperties: false };

export const QUIP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "quip", name: "Quip", connectorType: "native_clawchat",
  providerDocsUrl: "https://quip.com/dev/automation/documentation/current",
  providerWebsiteUrl: "https://quip.com/",
  capabilities: [
    { ...capability("knowledge_read", "Read Quip", "Read the connected user's authorized Quip knowledge and collaboration resources.", true), platformCapability: "quip_read" },
    { ...capability("knowledge_write", "Manage Quip content", "Create, edit, copy, message, upload, export, archive, and delete authorized Quip resources.", true), platformCapability: "quip_write" },
    { ...capability("sharing_manage", "Manage Quip sharing", "Manage authorized membership, access, link sharing, locks, and folders.", true), platformCapability: "quip_manage" },
  ],
  auth: { type: "oauth2_authorization_code", oauth: { authorizationUrl: "https://platform.quip.com/1/oauth/login", tokenUrl: "https://platform.quip.com/1/oauth/access_token", requiredScopes: [...QUIP_SCOPES], pkce: false, supportsRefresh: true }, credentialSchema: [
    { name: "QUIP_CLIENT_ID", label: "Quip API key client ID", required: true, secret: false, storedIn: "metadata", helpText: "A Quip company admin creates an API key with USER_READ, USER_WRITE, and USER_MANAGE." },
    { name: "QUIP_CLIENT_SECRET", label: "Quip API key client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Railway encrypts the customer-owned Quip API key secret and uses it only for Quip OAuth and revocation." },
  ] },
  tools: [
    { name: "quip.getCurrentUser", functionName: "quip_get_current_user", aliases: ["quip.getCurrentUser"], capability: "knowledge_read", platformCapability: "quip_read", action: "read", approvalRequired: false, description: "Read the authenticated Quip user and company binding.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "quip.listThreads", functionName: "quip_list_threads", aliases: ["quip.listThreads"], capability: "knowledge_read", platformCapability: "quip_read", action: "read", approvalRequired: false, description: "List up to 100 current-user threads with bounded cursor pagination.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 }, cursor: { type: "string" }, includeDeleted: { type: "boolean" } }, additionalProperties: false } },
    { name: "quip.getThread", functionName: "quip_get_thread", aliases: ["quip.getThread"], capability: "knowledge_read", platformCapability: "quip_read", action: "read", approvalRequired: false, description: "Read one authorized Quip thread by ID or secret path.", inputSchema: { type: "object", properties: { threadId: { type: "string" } }, required: ["threadId"], additionalProperties: false } },
    { name: "quip.uploadBlob", functionName: "quip_upload_blob", aliases: ["quip.uploadBlob"], capability: "knowledge_write", platformCapability: "quip_write", action: "write", approvalRequired: true, description: "Upload one bounded blob to one authorized Quip thread.", inputSchema: { type: "object", properties: { threadId: { type: "string" }, filename: { type: "string" }, mimeType: { type: "string" }, fileBase64: { type: "string" }, approvalId: { type: "string" } }, required: ["threadId", "filename", "mimeType", "fileBase64"], additionalProperties: false } },
    { name: "quip.request", functionName: "quip_request", aliases: ["quip.request"], capability: "sharing_manage", platformCapability: "quip_manage", action: "admin", approvalRequired: true, description: "Call the complete current Quip Automation API v1/v2 surface on the fixed Quip platform origin.", inputSchema: requestSchema },
  ],
  approvalProfiles: [
    { id: "quip_safe", label: "Safe", description: "Typed reads run directly; every upload, write, delete, export, message, or sharing/management request requires approval.", defaultSelected: true, allowedActions: [read], approvalRequiredActions: [write, manage], blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected, API-key-scoped Quip action runs without Relay per-action approval; ownership, fixed origin, selected capabilities, bounds, audits, secret non-exposure, Quip permissions, and provider limits still apply.", defaultSelected: false, allowedActions: [read, write, manage], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "current_user", label: "OAuth token, scopes, user, and company validation", requiredScopes: [...QUIP_SCOPES] }],
};
