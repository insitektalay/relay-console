import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  DROPBOX_PAPER_READ_ROUTES,
  DROPBOX_PAPER_WRITE_ROUTES,
} from "./dropbox-paper-api.adapter";

export const DROPBOX_PAPER_SCOPES = [
  "account_info.read",
  "files.metadata.read",
  "files.content.read",
  "files.content.write",
  "files.permanent_delete",
  "sharing.read",
  "sharing.write",
] as const;

const reads = [
  action(
    "dropbox_paper_read",
    "Read Dropbox Paper",
    "Read bounded Paper documents, exports, folders, members, and sharing metadata across both Dropbox storage models.",
  ),
];
const writes = [
  action(
    "dropbox_paper_write",
    "Manage Dropbox Paper",
    "Create, update, archive, delete, share, or change membership through one exact documented route; Safe mode requires approval.",
  ),
];

const argumentsSchema = {
  type: "object",
  maxProperties: 100,
  additionalProperties: true,
};

export const DROPBOX_PAPER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "dropbox-paper",
  name: "Dropbox Paper",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.dropbox.com/paper-migration-guide",
  providerWebsiteUrl: "https://www.dropbox.com/paper",
  capabilities: [
    {
      ...capability(
        "paper_read",
        "Read Paper",
        "Read account identity, storage mode, documents, exports, folders, members, and sharing metadata across legacy Paper and .paper files.",
        true,
      ),
      platformCapability: "dropbox_paper_read",
    },
    {
      ...capability(
        "paper_write",
        "Manage Paper",
        "Create, update, archive, delete, share, and manage members for legacy Paper documents and current .paper files.",
        true,
      ),
      platformCapability: "dropbox_paper_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.dropbox.com/oauth2/authorize",
      tokenUrl: "https://api.dropboxapi.com/oauth2/token",
      revocationUrl: "https://api.dropboxapi.com/2/auth/token/revoke",
      userInfoUrl: "https://api.dropboxapi.com/2/users/get_current_account",
      requiredScopes: [...DROPBOX_PAPER_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "DROPBOX_PAPER_CLIENT_ID",
        label: "Dropbox app key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned Dropbox app key configured on Railway.",
      },
      {
        name: "DROPBOX_PAPER_CLIENT_SECRET",
        label: "Dropbox app secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Relay-owned Dropbox app secret stored only in Railway.",
      },
    ],
  },
  tools: [
    {
      name: "dropboxPaper.read",
      functionName: "dropbox_paper_read",
      aliases: ["dropboxPaper.read", "dropbox_paper_read"],
      capability: "paper_read",
      platformCapability: "dropbox_paper_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call one exact documented Dropbox Paper, Files, Sharing, account, or feature read route. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          route: { type: "string", enum: [...DROPBOX_PAPER_READ_ROUTES] },
          arguments: argumentsSchema,
        },
        required: ["route", "arguments"],
        additionalProperties: false,
      },
    },
    {
      name: "dropboxPaper.write",
      functionName: "dropbox_paper_write",
      aliases: ["dropboxPaper.write", "dropbox_paper_write"],
      capability: "paper_write",
      platformCapability: "dropbox_paper_write",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one exact documented Dropbox Paper, Files, or Sharing mutation route. Content is accepted only by the documented create and update routes.",
      inputSchema: {
        type: "object",
        properties: {
          route: { type: "string", enum: [...DROPBOX_PAPER_WRITE_ROUTES] },
          arguments: argumentsSchema,
          content: { type: "string", maxLength: 2_000_000 },
          approvalId: { type: "string" },
        },
        required: ["route", "arguments"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "dropbox_paper_safe",
      label: "Safe",
      description:
        "Bounded Paper, file, folder, member, and sharing reads run directly; every mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Dropbox-authorized Paper operation runs without Relay per-action approval; ownership, scopes, fixed origins, exact routes, bounds, audits, redaction, account authority, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "account_and_paper_storage",
      label: "Dropbox account, refresh token, and Paper storage-mode check",
    },
  ],
};
