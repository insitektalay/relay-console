import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const OUTLOOK_REQUIRED_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "https://graph.microsoft.com/Mail.Read",
] as const;
export const OUTLOOK_OPTIONAL_SCOPES = [] as const;

const reads = [
  action(
    "outlook_mail_folders_list",
    "List Outlook mail folders",
    "Read up to twenty-five non-hidden root folders in the signed-in mailbox.",
  ),
  action(
    "outlook_inbox_messages_list",
    "List recent Inbox messages",
    "Read up to twenty-five newest message summaries from the signed-in user's Inbox.",
  ),
  action(
    "outlook_unread_messages_list",
    "List unread Inbox messages",
    "Read up to twenty-five newest unread message summaries from the signed-in user's Inbox.",
  ),
  action(
    "outlook_message_get",
    "Get Outlook message",
    "Read one explicit prior-result message as bounded plain text from the signed-in mailbox.",
  ),
];
const blockedActions = [
  blocked(
    "outlook_shared_application_mail",
    "Access other mailboxes",
    "Shared, delegated other-user, group, application-permission, and tenant-wide mail are blocked.",
  ),
  blocked(
    "outlook_attachments_mime_headers",
    "Access attachments or raw mail",
    "Attachments, MIME, raw headers, unsafe HTML, extensions, and custom properties are blocked.",
  ),
  blocked(
    "outlook_search_delta_subscriptions_export",
    "Search or export mail",
    "Search, arbitrary filters, delta, subscriptions, exports, automatic pagination, polling, and automatic retries are blocked.",
  ),
  blocked(
    "outlook_draft_reply_forward_send",
    "Draft or send mail",
    "Drafts, replies, forwards, sends, recipients changes, and every other external communication are blocked.",
  ),
  blocked(
    "outlook_message_mutation",
    "Mutate Outlook mail",
    "Moves, archives, read-state changes, categories, rules, deletes, batch operations, and folder changes are blocked.",
  ),
  blocked(
    "outlook_calendar_contacts_files_directory",
    "Access other Microsoft Graph data",
    "Calendar, contacts, files, Teams, users, directory, administration, and non-mail Graph workloads are blocked.",
  ),
  blocked(
    "outlook_raw_pagination",
    "Use raw Graph access",
    "Raw endpoints, arbitrary queries, beta Graph, page tokens, and CLI or MCP passthrough are blocked.",
  ),
];
const maxResults = { type: "integer", minimum: 1, maximum: 25, default: 25 };
const messageId = {
  type: "string",
  pattern: "^[A-Za-z0-9_=.~-]{1,1024}$",
  maxLength: 1024,
};

export const OUTLOOK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "outlook",
  name: "Outlook",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://learn.microsoft.com/graph/outlook-mail-concept-overview",
  providerWebsiteUrl:
    "https://www.microsoft.com/microsoft-365/outlook/outlook-for-business",
  capabilities: [
    {
      ...capability(
        "mail_folders_list",
        "List mail folders",
        "Read non-hidden root folders from the signed-in mailbox.",
        true,
      ),
      platformCapability: "outlook_mail_folders_list",
    },
    {
      ...capability(
        "inbox_messages_list",
        "Review recent Inbox",
        "Read bounded newest Inbox message summaries.",
        true,
      ),
      platformCapability: "outlook_inbox_messages_list",
    },
    {
      ...capability(
        "unread_messages_list",
        "Review unread Inbox",
        "Read bounded newest unread Inbox message summaries.",
        true,
      ),
      platformCapability: "outlook_unread_messages_list",
    },
    {
      ...capability(
        "message_get",
        "Read message",
        "Read one explicit message as bounded plain text.",
        true,
      ),
      platformCapability: "outlook_message_get",
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
      requiredScopes: [...OUTLOOK_REQUIRED_SCOPES],
      optionalScopes: [...OUTLOOK_OPTIONAL_SCOPES],
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
        helpText: "Railway-held Relay Console Entra application client ID.",
      },
      {
        name: "MICROSOFT_CLIENT_SECRET",
        label: "Microsoft application client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Railway-held confidential client secret; never sent to agents or clients.",
      },
    ],
  },
  tools: [
    {
      name: "outlook.listMailFolders",
      functionName: "outlook_mail_folders_list",
      aliases: ["outlook_mail_folders_list"],
      capability: "mail_folders_list",
      platformCapability: "outlook_mail_folders_list",
      action: "read",
      approvalRequired: false,
      description: "Read one first page of non-hidden root mail folders.",
      inputSchema: {
        type: "object",
        properties: { maxResults },
        additionalProperties: false,
      },
    },
    {
      name: "outlook.listInboxMessages",
      functionName: "outlook_inbox_messages_list",
      aliases: ["outlook_inbox_messages_list"],
      capability: "inbox_messages_list",
      platformCapability: "outlook_inbox_messages_list",
      action: "read",
      approvalRequired: false,
      description:
        "Read one newest-first page of signed-in-user Inbox message summaries.",
      inputSchema: {
        type: "object",
        properties: { maxResults },
        additionalProperties: false,
      },
    },
    {
      name: "outlook.listUnreadMessages",
      functionName: "outlook_unread_messages_list",
      aliases: ["outlook_unread_messages_list"],
      capability: "unread_messages_list",
      platformCapability: "outlook_unread_messages_list",
      action: "read",
      approvalRequired: false,
      description:
        "Read one newest-first page of unread signed-in-user Inbox message summaries.",
      inputSchema: {
        type: "object",
        properties: { maxResults },
        additionalProperties: false,
      },
    },
    {
      name: "outlook.getMessage",
      functionName: "outlook_message_get",
      aliases: ["outlook_message_get"],
      capability: "message_get",
      platformCapability: "outlook_message_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read one explicit prior-result message with at most eight thousand plain-text body characters.",
      inputSchema: {
        type: "object",
        properties: { messageId },
        required: ["messageId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "outlook_read_only",
      label: "Read only",
      description:
        "Four delegated signed-in-mailbox reads run automatically; other mailboxes, raw content, search/export, writes, other Graph workloads, and pagination remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The exact Mail.Read permission, signed-in /me boundary, four typed reads, privacy redaction, first-page-only behavior, and no-write invariants remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "exact-delegated-mail-read",
      label: "Exact delegated Mail.Read and signed-in mailbox",
      requiredScopes: [...OUTLOOK_REQUIRED_SCOPES],
    },
  ],
};
