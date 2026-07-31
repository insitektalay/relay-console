import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ONEDRIVE_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "Files.Read",
];

const reads = [
  action(
    "onedrive_drive_get",
    "Read connected drive",
    "Read bounded identity, type, web address, and quota metadata for the signed-in user's own OneDrive.",
  ),
  action(
    "onedrive_root_children_list",
    "List root items",
    "List at most twenty-five bounded file and folder metadata records from the connected drive root.",
  ),
  action(
    "onedrive_folder_children_list",
    "List folder items",
    "List at most twenty-five bounded children of one explicit folder from a prior result.",
  ),
  action(
    "onedrive_item_get",
    "Read item metadata",
    "Read bounded metadata for one explicit file or folder without downloading its content.",
  ),
];

const blockedActions = [
  blocked(
    "onedrive_content_download",
    "Read file content",
    "File bytes, download URLs, previews, thumbnails, workbook/document content, and content-derived metadata are outside V1.",
  ),
  blocked(
    "onedrive_shared_search_permissions",
    "Access broad storage surfaces",
    "Shared and remote items, search, recent items, share tokens, versions, permissions, subscriptions, delta, and exports are outside V1.",
  ),
  blocked(
    "onedrive_mutation",
    "Change files or folders",
    "Upload, create, rename, edit, move, copy, delete, restore, share, comment, lock, retention, and sensitivity-label changes are outside V1.",
  ),
  blocked(
    "onedrive_other_drives_admin_raw",
    "Access other Microsoft storage",
    "Other users, sites, groups, drives, application permissions, selected/admin permissions, automatic pagination, and raw Graph access are outside V1.",
  ),
];

const itemId = { type: "string", pattern: "^[A-Za-z0-9._!~-]{1,256}$" };

export const ONEDRIVE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "onedrive",
  name: "OneDrive",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://learn.microsoft.com/graph/onedrive-concept-overview",
  providerWebsiteUrl:
    "https://www.microsoft.com/microsoft-365/onedrive/online-cloud-storage",
  capabilities: [
    {
      ...capability(
        "drive_read",
        "Read connected drive",
        "Read bounded metadata and quota state for the signed-in user's own drive.",
        true,
      ),
      platformCapability: "onedrive_drive_read",
    },
    {
      ...capability(
        "item_read",
        "Read file and folder metadata",
        "List bounded root or explicit-folder items and inspect one exact item without file content.",
        true,
      ),
      platformCapability: "onedrive_item_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      authority: {
        provider: "microsoft",
        defaultMode: "multi_tenant_common",
        tenantIdEnv: "MICROSOFT_TENANT_ID",
      },
      requiredScopes: ONEDRIVE_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "MICROSOFT_CLIENT_ID",
        label: "Microsoft application client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Relay-owned Entra application ID configured only on Railway.",
      },
      {
        name: "MICROSOFT_CLIENT_SECRET",
        label: "Microsoft application client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth"],
        helpText: "Relay-owned Entra secret retained only by Railway.",
      },
    ],
  },
  tools: [
    {
      name: "onedrive.getDrive",
      functionName: "onedrive_drive_get",
      aliases: ["onedrive.getDrive", "onedrive_drive_get"],
      capability: "drive_read",
      platformCapability: "onedrive_drive_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded metadata and quota state for the connected user's own OneDrive.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "onedrive.listRootItems",
      functionName: "onedrive_root_children_list",
      aliases: ["onedrive.listRootItems", "onedrive_root_children_list"],
      capability: "item_read",
      platformCapability: "onedrive_item_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five bounded file and folder metadata records from the drive root.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "onedrive.listFolderItems",
      functionName: "onedrive_folder_children_list",
      aliases: ["onedrive.listFolderItems", "onedrive_folder_children_list"],
      capability: "item_read",
      platformCapability: "onedrive_item_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five bounded children of one explicit folder.",
      inputSchema: {
        type: "object",
        properties: { folderId: itemId },
        required: ["folderId"],
        additionalProperties: false,
      },
    },
    {
      name: "onedrive.getItem",
      functionName: "onedrive_item_get",
      aliases: ["onedrive.getItem", "onedrive_item_get"],
      capability: "item_read",
      platformCapability: "onedrive_item_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded metadata for one explicit file or folder without content.",
      inputSchema: {
        type: "object",
        properties: { itemId },
        required: ["itemId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "onedrive_safe",
      label: "Safe",
      description:
        "Four bounded metadata-only reads run automatically; every content, broad-access, write, admin, export, pagination, and raw surface remains blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same four selected reads run without Relay per-action approval; exact signed-in-drive binding, Microsoft-granted authority, limits, audit, redaction, and provider controls still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "drive",
      label:
        "Microsoft authorization, signed-in user, own-drive binding, exact scope, expiry, refresh, and bounded Graph validation",
      requiredScopes: ONEDRIVE_SCOPES,
    },
  ],
};
