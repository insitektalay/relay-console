import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_DRIVE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
];

const reads = [
  action("google_drive_file_search", "Find app-visible files", "Find at most twenty-five files created by Relay or explicitly shared with Relay."),
  action("google_drive_file_get", "Read file metadata", "Read bounded metadata for one app-visible file."),
  action("google_drive_file_content", "Read file content", "Read at most 256 KiB of text from one app-visible file."),
  action("google_drive_text_prepare", "Prepare text file", "Prepare and hash one bounded text file locally without changing Drive."),
];
const writes = [
  action("google_drive_text_create", "Create text file", "Create one bounded UTF-8 text file in the app-visible Drive corpus."),
  action("google_drive_file_copy", "Copy file", "Copy one app-visible file into one app-visible folder."),
];
const blockedActions = [
  blocked("google_drive_whole_drive", "Access the whole Drive", "Broad Drive discovery, restricted whole-Drive scopes, shared-drive crawling, and automatic pagination are outside V1."),
  blocked("google_drive_sharing_admin", "Change sharing or administration", "Permissions, ownership, public links, domain-wide delegation, labels, revisions, comments, and administration are outside V1."),
  blocked("google_drive_destructive", "Delete or overwrite files", "Delete, trash, overwrite, move, and other destructive file operations are outside V1."),
  blocked("google_drive_binary_raw", "Run broad binary or raw operations", "Arbitrary binary upload/download, broad export, raw API or MCP calls, and unbounded payloads are outside V1."),
];

const identifier = { type: "string", minLength: 1, maxLength: 200, pattern: "^[A-Za-z0-9_-]+$" };
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const idempotencyKey = { type: "string", minLength: 8, maxLength: 200 };

export const GOOGLE_DRIVE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-drive",
  name: "Google Drive",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.google.com/workspace/drive/api/guides/api-specific-auth",
  providerWebsiteUrl: "https://drive.google.com/",
  capabilities: [
    { ...capability("file_read", "Find and read files", "Find app-visible files and read bounded metadata or text content.", true), platformCapability: "google_drive_file_read" },
    { ...capability("file_draft", "Prepare files", "Prepare and hash bounded text-file changes locally.", true), platformCapability: "google_drive_file_draft" },
    { ...capability("file_write", "Create and copy files", "Create bounded text files and copy app-visible files after policy checks.", true), platformCapability: "google_drive_file_write" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_DRIVE_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      { name: "GOOGLE_OAUTH_CLIENT_ID", label: "Google OAuth client ID", required: true, secret: false, storedIn: "metadata", helpText: "Railway-held Relay Console confidential web OAuth client ID." },
      { name: "GOOGLE_OAUTH_CLIENT_SECRET", label: "Google OAuth client secret", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Railway-held Google OAuth client secret; never sent to clients or agents." },
    ],
  },
  tools: [
    {
      name: "googleDrive.searchFiles", functionName: "google_drive_file_search", aliases: ["google_drive_file_search"], capability: "file_read", platformCapability: "google_drive_file_read", action: "read", approvalRequired: false,
      description: "Find at most twenty-five app-visible files without following pagination.",
      inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 200 }, maxResults: { type: "integer", minimum: 1, maximum: 25 } }, additionalProperties: false },
    },
    {
      name: "googleDrive.getFile", functionName: "google_drive_file_get", aliases: ["google_drive_file_get"], capability: "file_read", platformCapability: "google_drive_file_read", action: "read", approvalRequired: false,
      description: "Read bounded metadata for one exact app-visible file.",
      inputSchema: { type: "object", properties: { fileId: identifier }, required: ["fileId"], additionalProperties: false },
    },
    {
      name: "googleDrive.readText", functionName: "google_drive_file_content", aliases: ["google_drive_file_content"], capability: "file_read", platformCapability: "google_drive_file_read", action: "read", approvalRequired: false,
      description: "Read at most 256 KiB of UTF-8 text from one exact app-visible file.",
      inputSchema: { type: "object", properties: { fileId: identifier }, required: ["fileId"], additionalProperties: false },
    },
    {
      name: "googleDrive.prepareTextFile", functionName: "google_drive_text_prepare", aliases: ["google_drive_text_prepare"], capability: "file_draft", platformCapability: "google_drive_file_draft", action: "draft", approvalRequired: false,
      description: "Prepare and hash one bounded UTF-8 text file locally.",
      inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 200 }, text: { type: "string", maxLength: 262144 }, parentFolderId: identifier }, required: ["name", "text"], additionalProperties: false },
    },
    {
      name: "googleDrive.createTextFile", functionName: "google_drive_text_create", aliases: ["google_drive_text_create"], capability: "file_write", platformCapability: "google_drive_file_write", action: "write", approvalRequired: true,
      description: "Create one bounded UTF-8 text file after approval checks.",
      inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 200 }, text: { type: "string", maxLength: 262144 }, parentFolderId: identifier, approvalId, idempotencyKey }, required: ["name", "text", "approvalId", "idempotencyKey"], additionalProperties: false },
    },
    {
      name: "googleDrive.copyFile", functionName: "google_drive_file_copy", aliases: ["google_drive_file_copy"], capability: "file_write", platformCapability: "google_drive_file_write", action: "write", approvalRequired: true,
      description: "Copy one app-visible file into one app-visible folder after approval checks.",
      inputSchema: { type: "object", properties: { fileId: identifier, parentFolderId: identifier, name: { type: "string", minLength: 1, maxLength: 200 }, approvalId, idempotencyKey }, required: ["fileId", "approvalId", "idempotencyKey"], additionalProperties: false },
    },
  ],
  approvalProfiles: [
    { id: "google_drive_safe", label: "Safe", description: "Bounded app-visible reads and local preparation run automatically; creates and copies require matching approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: writes, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "All six selected tools run without Relay per-action approval while drive.file, app-visible corpus, account binding, payload limits, audit, redaction, refresh, revocation, and provider limits remain enforced.", defaultSelected: false, allowedActions: [...reads, ...writes], approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "app-visible-files", label: "Google account, exact drive.file scope, refresh lifecycle, and app-visible file access", requiredScopes: GOOGLE_DRIVE_SCOPES }],
};
