import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const BOX_SCOPES = ["root_readwrite"];

const reads = [
  action(
    "box_user_get",
    "View connected user",
    "Read the connected Box user and enterprise context.",
  ),
  action(
    "box_folder_items",
    "List folder items",
    "List one bounded marker page from one explicit folder.",
  ),
  action(
    "box_file_get",
    "Read file metadata",
    "Read useful metadata for one explicit file.",
  ),
  action(
    "box_folder_get",
    "Read folder metadata",
    "Read useful metadata for one explicit folder.",
  ),
  action(
    "box_content_search",
    "Search content",
    "Search one bounded marker page of Box content.",
  ),
  action(
    "box_text_upload_prepare",
    "Prepare text upload",
    "Prepare and hash one bounded UTF-8 upload locally.",
  ),
];
const writes = [
  action(
    "box_folder_create",
    "Create folder",
    "Create one folder under one explicit parent.",
  ),
  action(
    "box_text_upload",
    "Upload text file",
    "Upload one bounded UTF-8 text file to one folder.",
  ),
  action(
    "box_item_copy",
    "Copy item",
    "Copy one explicit file or folder to one destination.",
  ),
  action(
    "box_item_move",
    "Move or rename item",
    "Move or rename one explicit file or folder, optionally guarded by etag.",
  ),
];
const blockedActions = [
  blocked(
    "box_delete_trash",
    "Delete or restore content",
    "Delete, trash, purge, restore, and broad destructive operations are outside V1.",
  ),
  blocked(
    "box_collaboration_admin",
    "Change sharing or administration",
    "Collaborations, shared links, comments, tasks, users, groups, enterprise settings, impersonation, Sign, AI, Relay, and admin operations are outside V1.",
  ),
  blocked(
    "box_binary_broad",
    "Run broad or binary operations",
    "Downloads, previews, arbitrary binaries, versions, locks, metadata, classifications, events, webhooks, migrations, automatic pagination, and raw API calls are outside V1.",
  ),
];

export const BOX_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "box",
  name: "Box",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.box.com/reference/",
  providerWebsiteUrl: "https://www.box.com/",
  capabilities: [
    {
      ...capability(
        "user_read",
        "View connected user",
        "Identify the connected Box user and enterprise.",
        true,
      ),
      platformCapability: "box_user_read",
    },
    {
      ...capability(
        "content_read",
        "Find and inspect content",
        "List folders, inspect file or folder metadata, and search bounded content.",
        true,
      ),
      platformCapability: "box_content_read",
    },
    {
      ...capability(
        "content_draft",
        "Prepare uploads",
        "Prepare and hash exact bounded text uploads locally.",
        true,
      ),
      platformCapability: "box_content_draft",
    },
    {
      ...capability(
        "content_write",
        "Organize content",
        "Create folders, upload bounded text, copy items, and move or rename items.",
        true,
      ),
      platformCapability: "box_content_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://account.box.com/api/oauth2/authorize",
      tokenUrl: "https://api.box.com/oauth2/token",
      refreshUrl: "https://api.box.com/oauth2/token",
      requiredScopes: BOX_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "BOX_CLIENT_ID",
        label: "Box client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Box OAuth client ID.",
      },
      {
        name: "BOX_CLIENT_SECRET",
        label: "Box client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Box client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    tool(
      "box.getCurrentUser",
      "box_get_current_user",
      "user_read",
      "read",
      false,
      "Read the connected Box user and enterprise context.",
      {},
    ),
    tool(
      "box.listFolderItems",
      "box_list_folder_items",
      "content_read",
      "read",
      false,
      "List at most fifty direct items from one folder without following pagination.",
      {
        folderId: identifier(false),
        maxResults: integer(1, 50),
        marker: text(1, 500),
      },
    ),
    tool(
      "box.getFile",
      "box_get_file",
      "content_read",
      "read",
      false,
      "Read useful metadata for one explicit file.",
      { fileId: identifier() },
      ["fileId"],
    ),
    tool(
      "box.getFolder",
      "box_get_folder",
      "content_read",
      "read",
      false,
      "Read useful metadata for one explicit folder.",
      { folderId: identifier() },
      ["folderId"],
    ),
    tool(
      "box.searchContent",
      "box_search_content",
      "content_read",
      "read",
      false,
      "Search at most twenty-five Box items without following pagination.",
      {
        query: text(1, 200),
        ancestorFolderIds: text(1, 500),
        maxResults: integer(1, 25),
        marker: text(1, 500),
      },
      ["query"],
    ),
    tool(
      "box.prepareTextUpload",
      "box_prepare_text_upload",
      "content_draft",
      "draft",
      false,
      "Prepare one bounded UTF-8 text upload locally without changing Box.",
      {
        parentFolderId: identifier(false),
        name: itemName(),
        text: text(0, 262144),
      },
      ["name", "text"],
    ),
    tool(
      "box.createFolder",
      "box_create_folder",
      "content_write",
      "write",
      true,
      "Create one folder under one explicit parent.",
      writeFields({ parentFolderId: identifier(false), name: itemName() }),
      ["name", "approvalId", "idempotencyKey"],
    ),
    tool(
      "box.uploadText",
      "box_upload_text",
      "content_write",
      "write",
      true,
      "Upload one bounded UTF-8 text file.",
      writeFields({
        parentFolderId: identifier(false),
        name: itemName(),
        text: text(0, 262144),
      }),
      ["name", "text", "approvalId", "idempotencyKey"],
    ),
    tool(
      "box.copyItem",
      "box_copy_item",
      "content_write",
      "write",
      true,
      "Copy one file or folder to one destination folder.",
      writeFields({
        itemType: itemType(),
        itemId: identifier(),
        destinationFolderId: identifier(false),
        name: itemName(false),
      }),
      ["itemType", "itemId", "approvalId", "idempotencyKey"],
    ),
    tool(
      "box.moveItem",
      "box_move_item",
      "content_write",
      "write",
      true,
      "Move or rename one file or folder, optionally guarded by etag.",
      writeFields({
        itemType: itemType(),
        itemId: identifier(),
        destinationFolderId: identifier(false),
        name: itemName(false),
        etag: text(1, 200),
      }),
      ["itemType", "itemId", "approvalId", "idempotencyKey"],
    ),
  ],
  approvalProfiles: [
    {
      id: "box_safe",
      label: "Safe",
      description:
        "Bounded reads and local drafts run directly; every Box mutation requires matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Box operation supported by this connector runs without Relay per-action approval; connection ownership, OAuth grants, bounds, audits, redaction, idempotency, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [{ id: "user", label: "Connected Box user and enterprise" }],
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
    platformCapability: `box_${capabilityId}`,
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
function text(minLength: number, maxLength: number) {
  return { type: "string", minLength, maxLength };
}
function integer(minimum: number, maximum: number) {
  return { type: "integer", minimum, maximum };
}
function identifier(required = true) {
  return required ? text(1, 500) : text(0, 500);
}
function itemName(required = true) {
  return required ? text(1, 255) : text(0, 255);
}
function itemType() {
  return { type: "string", enum: ["file", "folder"] };
}
function writeFields(fields: Record<string, unknown>) {
  return { ...fields, approvalId: text(1, 200), idempotencyKey: text(1, 180) };
}
