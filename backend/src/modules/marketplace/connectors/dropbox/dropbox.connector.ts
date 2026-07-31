import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const DROPBOX_SCOPES = [
  "account_info.read",
  "files.metadata.read",
  "files.content.read",
  "files.metadata.write",
  "files.content.write",
];

const reads = [
  action(
    "dropbox_account_get",
    "Read account",
    "Read the connected Dropbox account identity and root namespace.",
  ),
  action(
    "dropbox_folder_list",
    "List a folder",
    "List one bounded page of entries in an explicit folder.",
  ),
  action(
    "dropbox_entry_get",
    "Read entry metadata",
    "Read metadata for one explicit file or folder.",
  ),
  action(
    "dropbox_entry_search",
    "Search files",
    "Search one bounded page of file and folder metadata.",
  ),
  action(
    "dropbox_text_download",
    "Read a text file",
    "Download at most 256 KiB from one explicit text file.",
  ),
  action(
    "dropbox_change_prepare",
    "Prepare a file change",
    "Prepare and hash one Dropbox mutation locally.",
  ),
];
const writes = [
  action(
    "dropbox_folder_create",
    "Create folder",
    "Create one folder at an explicit path.",
  ),
  action(
    "dropbox_text_upload",
    "Upload text",
    "Create or replace one bounded UTF-8 text file.",
  ),
  action(
    "dropbox_entry_copy",
    "Copy entry",
    "Copy one explicit file or folder to one destination.",
  ),
  action(
    "dropbox_entry_move",
    "Move entry",
    "Move or rename one explicit file or folder.",
  ),
  action(
    "dropbox_entry_delete",
    "Delete entry",
    "Delete one explicit file or folder; Safe mode requires approval.",
  ),
];
const blockedActions = [
  blocked(
    "dropbox_sharing_admin",
    "Change sharing or team administration",
    "Shared links, members, permissions, team administration, impersonation, and namespace selection are outside V1.",
  ),
  blocked(
    "dropbox_bulk_unbounded",
    "Run broad or bulk operations",
    "Recursive traversal, automatic pagination, upload sessions, batch mutations, restore, permanent deletion, and broad exports are outside V1.",
  ),
  blocked(
    "dropbox_raw_api",
    "Call arbitrary Dropbox APIs",
    "Raw RPC, content, Business, Paper, Sign, and untyped endpoints are never exposed through this connector.",
  ),
];

export const DROPBOX_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "dropbox",
  name: "Dropbox",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://www.dropbox.com/developers/documentation/http/documentation",
  providerWebsiteUrl: "https://www.dropbox.com/",
  capabilities: [
    {
      ...capability(
        "account_read",
        "View connected account",
        "Identify the connected account and root namespace.",
        true,
      ),
      platformCapability: "dropbox_account_read",
    },
    {
      ...capability(
        "file_read",
        "Find and read files",
        "List folders, inspect metadata, search, and read bounded text files.",
        true,
      ),
      platformCapability: "dropbox_file_read",
    },
    {
      ...capability(
        "file_draft",
        "Prepare file changes",
        "Prepare exact folder, upload, copy, move, or delete changes locally.",
        true,
      ),
      platformCapability: "dropbox_file_draft",
    },
    {
      ...capability(
        "file_write",
        "Organize files",
        "Create folders, upload text, copy, move, rename, and delete explicit entries.",
        true,
      ),
      platformCapability: "dropbox_file_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.dropbox.com/oauth2/authorize",
      tokenUrl: "https://api.dropboxapi.com/oauth2/token",
      refreshUrl: "https://api.dropboxapi.com/oauth2/token",
      requiredScopes: DROPBOX_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "DROPBOX_CLIENT_ID",
        label: "Dropbox app key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Dropbox app key.",
      },
      {
        name: "DROPBOX_CLIENT_SECRET",
        label: "Dropbox app secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Dropbox app secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    tool(
      "dropbox.getCurrentAccount",
      "dropbox_get_current_account",
      "account_read",
      "read",
      false,
      "Read the connected Dropbox account identity.",
      {},
    ),
    tool(
      "dropbox.listFolder",
      "dropbox_list_folder",
      "file_read",
      "read",
      false,
      "List at most fifty direct entries from one folder without following pagination.",
      { path: path(false), maxResults: integer(1, 50) },
    ),
    tool(
      "dropbox.getMetadata",
      "dropbox_get_metadata",
      "file_read",
      "read",
      false,
      "Read metadata for one explicit file or folder.",
      { path: path() },
      ["path"],
    ),
    tool(
      "dropbox.search",
      "dropbox_search",
      "file_read",
      "read",
      false,
      "Search at most twenty-five entries in one optional folder.",
      { query: text(1, 200), path: path(false), maxResults: integer(1, 25) },
      ["query"],
    ),
    tool(
      "dropbox.downloadText",
      "dropbox_download_text",
      "file_read",
      "read",
      false,
      "Read at most 256 KiB from one explicit UTF-8 text file.",
      { path: path(), maxBytes: integer(1, 262144) },
      ["path"],
    ),
    tool(
      "dropbox.draftChange",
      "dropbox_draft_change",
      "file_draft",
      "draft",
      false,
      "Prepare one Dropbox mutation locally without changing files.",
      {
        operation: {
          type: "string",
          enum: ["create_folder", "upload_text", "copy", "move", "delete"],
        },
        path: path(false),
        fromPath: path(false),
        toPath: path(false),
        text: text(0, 262144),
        mode: { type: "string", enum: ["add", "overwrite"] },
      },
      ["operation"],
    ),
    tool(
      "dropbox.createFolder",
      "dropbox_create_folder",
      "file_write",
      "write",
      true,
      "Create one folder at an explicit path.",
      writeFields({ path: path() }),
      ["path", "approvalId", "idempotencyKey"],
    ),
    tool(
      "dropbox.uploadText",
      "dropbox_upload_text",
      "file_write",
      "write",
      true,
      "Upload one bounded UTF-8 text file.",
      writeFields({
        path: path(),
        text: text(0, 262144),
        mode: { type: "string", enum: ["add", "overwrite"] },
      }),
      ["path", "text", "approvalId", "idempotencyKey"],
    ),
    tool(
      "dropbox.copyEntry",
      "dropbox_copy_entry",
      "file_write",
      "write",
      true,
      "Copy one entry to one explicit destination.",
      writeFields({ fromPath: path(), toPath: path() }),
      ["fromPath", "toPath", "approvalId", "idempotencyKey"],
    ),
    tool(
      "dropbox.moveEntry",
      "dropbox_move_entry",
      "file_write",
      "write",
      true,
      "Move or rename one explicit entry.",
      writeFields({ fromPath: path(), toPath: path() }),
      ["fromPath", "toPath", "approvalId", "idempotencyKey"],
    ),
    tool(
      "dropbox.deleteEntry",
      "dropbox_delete_entry",
      "file_write",
      "write",
      true,
      "Delete one explicit file or folder.",
      writeFields({ path: path() }),
      ["path", "approvalId", "idempotencyKey"],
    ),
  ],
  approvalProfiles: [
    {
      id: "dropbox_safe",
      label: "Safe",
      description:
        "Bounded reads and local drafts run directly; every Dropbox mutation requires matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Dropbox operation supported by this connector runs without Relay per-action approval; connection ownership, OAuth grants, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "account", label: "Connected Dropbox account and root namespace" },
  ],
};

function tool(
  name: string,
  alias: string,
  capabilityId: string,
  actionName: "read" | "draft" | "write",
  approvalRequired: boolean,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) {
  return {
    name,
    functionName: alias,
    aliases: [name, alias],
    capability: capabilityId,
    platformCapability: `dropbox_${capabilityId}`,
    action: actionName,
    approvalRequired,
    description,
    inputSchema: {
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    },
  };
}
function path(required = true) {
  return {
    type: "string",
    ...(required ? { minLength: 1 } : {}),
    maxLength: 1024,
  };
}
function text(minLength: number, maxLength: number) {
  return { type: "string", minLength, maxLength };
}
function integer(minimum: number, maximum: number) {
  return { type: "integer", minimum, maximum };
}
function writeFields(properties: Record<string, unknown>) {
  return {
    ...properties,
    autorename: { type: "boolean" },
    approvalId: { type: "string", minLength: 1, maxLength: 180 },
    idempotencyKey: { type: "string", minLength: 1, maxLength: 180 },
  };
}
