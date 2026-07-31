import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_CHAT_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages.readonly",
  "https://www.googleapis.com/auth/chat.messages.create",
];

const reads = [
  action(
    "google_chat_space_get",
    "Get Chat space",
    "Read bounded metadata for one explicit Chat Space.",
  ),
  action(
    "google_chat_messages_list",
    "List Chat messages",
    "Read the newest first page of at most twenty-five plain-text messages in one explicit Space.",
  ),
  action(
    "google_chat_message_prepare",
    "Prepare Chat message",
    "Validate a bounded plain-text message or explicit-thread reply locally.",
  ),
];
const writes = [
  action(
    "google_chat_message_create",
    "Send Chat message",
    "Send one bounded plain-text message or fail-closed thread reply.",
  ),
];
const blockedActions = [
  blocked(
    "google_chat_space_list_search",
    "Discover Chat spaces",
    "Broad Space listing and search are blocked in V1.",
  ),
  blocked(
    "google_chat_space_admin",
    "Administer Chat spaces",
    "Creating, updating, deleting, or importing Chat Spaces is blocked.",
  ),
  blocked(
    "google_chat_memberships",
    "Access Chat memberships",
    "Membership and identity access is blocked in V1.",
  ),
  blocked(
    "google_chat_message_mutation",
    "Modify or delete Chat messages",
    "Existing-message update and deletion are blocked.",
  ),
  blocked(
    "google_chat_private_rich_media",
    "Use private or rich Chat content",
    "Private messages, cards, widgets, annotations, attachments, and media are outside plain-text V1.",
  ),
  blocked(
    "google_chat_reactions",
    "Use Chat reactions",
    "Reactions and custom emoji are blocked.",
  ),
  blocked(
    "google_chat_app_bot_admin_import",
    "Use app, bot, admin, or import access",
    "Only narrowly scoped user authentication is permitted.",
  ),
  blocked(
    "google_chat_raw_paginate_delegation",
    "Use raw, paginated, or delegated Chat access",
    "Raw endpoints, automatic pagination or retries, and delegation are blocked.",
  ),
];
const spaceName = {
  type: "string",
  minLength: 8,
  maxLength: 256,
  pattern: "^spaces/[A-Za-z0-9_-]+$",
};
const threadName = {
  type: "string",
  minLength: 18,
  maxLength: 384,
  pattern: "^spaces/[A-Za-z0-9_-]+/threads/[A-Za-z0-9_-]+$",
};
const messageText = { type: "string", minLength: 1, maxLength: 4000 };
const requestId = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9_-]+$",
};
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const GOOGLE_CHAT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-chat",
  name: "Google Chat",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.google.com/workspace/chat/api/overview",
  providerWebsiteUrl: "https://chat.google.com/",
  capabilities: [
    {
      ...capability(
        "space_read",
        "Read explicit Spaces",
        "Read bounded metadata for one caller-supplied Chat Space.",
        true,
      ),
      platformCapability: "google_chat_space_read",
    },
    {
      ...capability(
        "message_read",
        "Read plain-text messages",
        "Read one newest-first page of privacy-bounded messages.",
        true,
      ),
      platformCapability: "google_chat_message_read",
    },
    {
      ...capability(
        "message_write",
        "Prepare and send messages",
        "Prepare locally and send one bounded plain-text message or fail-closed reply.",
        true,
      ),
      platformCapability: "google_chat_message_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_CHAT_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GOOGLE_OAUTH_CLIENT_ID",
        label: "Google OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console confidential web OAuth client ID.",
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Google OAuth client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "googleChat.getSpace",
      functionName: "google_chat_space_get",
      aliases: ["google_chat_space_get"],
      capability: "space_read",
      platformCapability: "google_chat_space_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded non-membership metadata for one explicit Chat Space.",
      inputSchema: {
        type: "object",
        properties: { spaceName },
        required: ["spaceName"],
        additionalProperties: false,
      },
    },
    {
      name: "googleChat.listMessages",
      functionName: "google_chat_messages_list",
      aliases: ["google_chat_messages_list"],
      capability: "message_read",
      platformCapability: "google_chat_message_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most twenty-five newest plain-text messages from one explicit Space without following pagination.",
      inputSchema: {
        type: "object",
        properties: {
          spaceName,
          pageSize: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["spaceName"],
        additionalProperties: false,
      },
    },
    {
      name: "googleChat.prepareMessage",
      functionName: "google_chat_message_prepare",
      aliases: ["google_chat_message_prepare"],
      capability: "message_write",
      platformCapability: "google_chat_message_write",
      action: "draft",
      approvalRequired: false,
      description:
        "Validate one bounded plain-text message or same-Space thread reply locally.",
      inputSchema: {
        type: "object",
        properties: { spaceName, text: messageText, threadName },
        required: ["spaceName", "text"],
        additionalProperties: false,
      },
    },
    {
      name: "googleChat.createMessage",
      functionName: "google_chat_message_create",
      aliases: ["google_chat_message_create"],
      capability: "message_write",
      platformCapability: "google_chat_message_write",
      action: "write",
      approvalRequired: true,
      description:
        "Send one idempotent bounded plain-text message or fail-closed same-Space thread reply.",
      inputSchema: {
        type: "object",
        properties: {
          spaceName,
          text: messageText,
          threadName,
          requestId,
          approvalId,
        },
        required: ["spaceName", "text", "requestId", "approvalId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "google_chat_safe",
      label: "Safe",
      description:
        "Explicit-Space reads and local plain-text preparation run automatically; message creation requires matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected tools run without Relay per-action approval while exact user scopes, explicit Spaces, plain-text and thread bounds, idempotency, privacy redaction, audit, refresh, revocation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "explicit-space-plain-text",
      label:
        "Google account, exact user scopes, explicit Spaces, plain-text bounds, and identity redaction",
      requiredScopes: GOOGLE_CHAT_SCOPES,
    },
  ],
};
