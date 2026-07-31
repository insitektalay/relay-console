import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { GMAIL_SCOPES } from "./gmail-api.adapter";
const reads = [
  action(
    "gmail_message_search",
    "Search messages",
    "Search at most twenty-five messages and return bounded headers/snippets.",
  ),
  action(
    "gmail_message_read",
    "Read message",
    "Read one exact message with a bounded plain-text excerpt and no attachments.",
  ),
  action(
    "gmail_label_list",
    "List labels",
    "List bounded label identity metadata.",
  ),
];
const drafts = [
  action(
    "gmail_draft_create",
    "Create draft",
    "Create one bounded plain-text draft for explicit recipients without sending.",
  ),
];
const sends = [
  action(
    "gmail_message_send",
    "Send message",
    "Send one exact reviewed bounded plain-text message to explicit recipients.",
  ),
];
const blockedActions = [
  blocked(
    "gmail_mailbox_modify",
    "Modify mailbox",
    "Label mutation, archive, trash, delete, import, insert, batch mutation, history, forwarding, filters, delegates, settings, and administration are outside V1.",
  ),
  blocked(
    "gmail_bulk_export",
    "Export mail",
    "Bulk export, automatic pagination, attachment retrieval, long-term caching, scraping, and model training are blocked.",
  ),
  blocked(
    "gmail_raw_api",
    "Use raw Gmail API",
    "Arbitrary methods, paths, queries, MIME, raw provider/MCP tools, broader scopes, and credentials are outside V1.",
  ),
  blocked(
    "gmail_unsolicited_send",
    "Send unsolicited mail",
    "Spam, bulk commercial mail, credential/token transmission, and bypass of Gmail abuse or safety controls are blocked.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const messageFields = {
  to: {
    type: "array",
    minItems: 1,
    maxItems: 20,
    items: { type: "string", maxLength: 320 },
  },
  subject: { type: "string", minLength: 1, maxLength: 500 },
  body: { type: "string", minLength: 1, maxLength: 20000 },
};
export const GMAIL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "gmail",
  name: "Gmail",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.google.com/workspace/gmail/api/reference/rest",
  providerWebsiteUrl: "https://mail.google.com/",
  capabilities: [
    {
      ...capability(
        "email_read",
        "Read email",
        "Search and inspect bounded Gmail message content and labels.",
        true,
      ),
      platformCapability: "gmail_email_read",
    },
    {
      ...capability(
        "email_draft",
        "Create drafts",
        "Prepare bounded drafts without sending.",
        true,
      ),
      platformCapability: "gmail_email_draft",
    },
    {
      ...capability(
        "email_send",
        "Send email",
        "Send exact reviewed messages under approval policy.",
        false,
      ),
      platformCapability: "gmail_email_send",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GMAIL_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GMAIL_CLIENT_ID",
        label: "Gmail Google OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned verified confidential Google OAuth client ID configured only on Railway.",
      },
      {
        name: "GMAIL_CLIENT_SECRET",
        label: "Gmail Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential Google OAuth secret configured only on Railway.",
      },
      {
        name: "GMAIL_ACCOUNT_EMAIL",
        label: "Authorized Gmail account",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth2"],
        helpText: "Bind one exact Gmail account before authorization.",
      },
    ],
  },
  tools: [
    {
      name: "gmail.searchMessages",
      functionName: "gmail_message_search",
      aliases: ["gmail.searchMessages", "gmail_message_search"],
      capability: "email_read",
      platformCapability: "gmail_email_read",
      action: "read",
      approvalRequired: false,
      description:
        "Search bounded message headers and snippets without pagination.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 500 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "gmail.getMessage",
      functionName: "gmail_message_read",
      aliases: ["gmail.getMessage", "gmail_message_read"],
      capability: "email_read",
      platformCapability: "gmail_email_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact message with bounded plain text and no attachments.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", minLength: 1, maxLength: 200 },
        },
        required: ["messageId"],
        additionalProperties: false,
      },
    },
    {
      name: "gmail.listLabels",
      functionName: "gmail_label_list",
      aliases: ["gmail.listLabels", "gmail_label_list"],
      capability: "email_read",
      platformCapability: "gmail_email_read",
      action: "read",
      approvalRequired: false,
      description: "List bounded Gmail labels.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "gmail.createDraft",
      functionName: "gmail_draft_create",
      aliases: ["gmail.createDraft", "gmail_draft_create"],
      capability: "email_draft",
      platformCapability: "gmail_email_draft",
      action: "draft",
      approvalRequired: false,
      description: "Create one bounded plain-text draft without sending.",
      inputSchema: {
        type: "object",
        properties: messageFields,
        required: ["to", "subject", "body"],
        additionalProperties: false,
      },
    },
    {
      name: "gmail.sendMessage",
      functionName: "gmail_message_send",
      aliases: ["gmail.sendMessage", "gmail_message_send"],
      capability: "email_send",
      platformCapability: "gmail_email_send",
      action: "write",
      approvalRequired: true,
      description: "Send one exact reviewed bounded plain-text message.",
      inputSchema: {
        type: "object",
        properties: { ...messageFields, approvalId },
        required: ["to", "subject", "body", "approvalId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "gmail_safe",
      label: "Safe",
      description:
        "Bounded reads and draft creation are direct; exact sends require approval.",
      defaultSelected: true,
      allowedActions: [...reads, ...drafts],
      approvalRequiredActions: sends,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All five selected tools run without per-action approval while exact scopes/account, bounds, recipient checks, audit, and provider controls remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...drafts, ...sends],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "account-restricted-scope-boundary",
      label:
        "Gmail exact readonly/compose restricted scopes, offline refresh token, verified app, and account binding",
      requiredScopes: GMAIL_SCOPES,
    },
  ],
};
