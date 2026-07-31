import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ZOHO_MAIL_REQUIRED_SCOPES = [
  "ZohoMail.accounts.READ",
  "ZohoMail.folders.READ",
  "ZohoMail.messages.READ",
] as const;

const reads = [
  action("zoho_mail_accounts_list", "List mail accounts", "List authenticated Zoho Mail accounts."),
  action("zoho_mail_folders_list", "List account folders", "List folders for one verified account."),
  action("zoho_mail_messages_list_filtered", "List filtered messages", "Review one bounded filtered message list."),
  action("zoho_mail_message_get", "Read one message", "Read one explicit message with bounded sanitized text and attachment metadata."),
];

const blocks = [
  blocked("zoho_mail_writes", "Block mail writes", "Sending, replies, forwarding, drafts, moves, labels, flags, archive, spam and deletion are not exposed."),
  blocked("zoho_mail_attachment_downloads", "Block attachment downloads", "Only bounded attachment metadata may be returned; binary downloads are not exposed."),
  blocked("zoho_mail_administration", "Block administration", "Organization, user, group, policy and other administrative APIs are not exposed."),
  blocked("zoho_mail_broad_raw", "Block broad and raw access", "Bulk export, automatic pagination and arbitrary provider endpoints are not exposed."),
];

export const ZOHO_MAIL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoho-mail",
  name: "Zoho Mail",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.zoho.com/mail/help/api/",
  providerWebsiteUrl: "https://www.zoho.com/mail/",
  capabilities: [
    {
      ...capability("account_read", "List mail accounts", "List authenticated Zoho Mail accounts.", true),
      platformCapability: "account_read",
    },
    {
      ...capability("folder_read", "List folders", "List folders for one verified account.", true),
      platformCapability: "folder_read",
    },
    {
      ...capability("message_list_read", "List filtered messages", "Review one bounded filtered message list.", true),
      platformCapability: "message_list_read",
    },
    {
      ...capability("message_read", "Read one message", "Read one explicit message with bounded sanitized text.", true),
      platformCapability: "message_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      requiredScopes: [...ZOHO_MAIL_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ZOHO_MAIL_CLIENT_ID",
        label: "Zoho Mail client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held multi-data-center server-client ID.",
      },
      {
        name: "ZOHO_MAIL_CLIENT_SECRET",
        label: "Zoho Mail client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Railway-held confidential secret; never returned to RelayConsoleSwift or an agent.",
      },
    ],
  },
  tools: [
    {
      name: "relay_zoho_mail_list_accounts",
      functionName: "relay_zoho_mail_list_accounts",
      aliases: ["zoho_mail_accounts_list"],
      capability: "account_read",
      platformCapability: "account_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five authenticated Zoho Mail accounts.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "relay_zoho_mail_list_folders",
      functionName: "relay_zoho_mail_list_folders",
      aliases: ["zoho_mail_folders_list"],
      capability: "folder_read",
      platformCapability: "folder_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five folders for the connection-bound mail account.",
      inputSchema: {
        type: "object",
        properties: { accountId: { type: "string", pattern: "^[0-9]+$", maxLength: 64 } },
        required: ["accountId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_zoho_mail_list_messages_filtered",
      functionName: "relay_zoho_mail_list_messages_filtered",
      aliases: ["zoho_mail_messages_list_filtered"],
      capability: "message_list_read",
      platformCapability: "message_list_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five message summaries in one explicit folder without pagination.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", pattern: "^[0-9]+$", maxLength: 64 },
          folderId: { type: "string", pattern: "^[0-9]+$", maxLength: 64 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["accountId", "folderId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_zoho_mail_get_message",
      functionName: "relay_zoho_mail_get_message",
      aliases: ["zoho_mail_message_get"],
      capability: "message_read",
      platformCapability: "message_read",
      action: "read",
      approvalRequired: false,
      description: "Read one explicit message with bounded sanitized text and attachment metadata only.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", pattern: "^[0-9]+$", maxLength: 64 },
          folderId: { type: "string", pattern: "^[0-9]+$", maxLength: 64 },
          messageId: { type: "string", pattern: "^[0-9]+$", maxLength: 64 },
        },
        required: ["accountId", "folderId", "messageId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoho_mail_read_only",
      label: "Read only",
      description: "Only four fixed bounded Zoho Mail reads are enabled.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "zoho_mail_no_access",
      label: "No access",
      description: "All Zoho Mail actions are blocked.",
      defaultSelected: false,
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [...blocks, ...reads],
    },
  ],
  healthChecks: [
    {
      id: "bound_mail_account",
      label: "Regional Zoho Mail account and refresh lifecycle",
      requiredScopes: [...ZOHO_MAIL_REQUIRED_SCOPES],
    },
  ],
};
