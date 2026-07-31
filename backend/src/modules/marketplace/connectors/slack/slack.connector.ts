import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const SLACK_REQUIRED_SCOPES = [
  "channels:read",
  "channels:history",
  "chat:write",
  "users:read",
];

const readsAndDraft = [
  action(
    "slack_conversations_list",
    "List public channels",
    "List at most fifty visible public Slack channels without pagination.",
  ),
  action(
    "slack_conversation_history_read",
    "Read channel or thread history",
    "Read at most fifty messages from one explicit public channel or thread.",
  ),
  action(
    "slack_message_draft",
    "Draft Slack message",
    "Prepare one bounded Slack message locally without a provider side effect.",
  ),
];

const writes = [
  action(
    "slack_message_send",
    "Send Slack message",
    "Send one exact approval-controlled message to an explicit channel.",
  ),
];

const blockedActions = [
  blocked(
    "slack_admin",
    "Block administration",
    "Workspace, user, app, channel and organization administration are not exposed.",
  ),
  blocked(
    "slack_sensitive_reads",
    "Block sensitive reads",
    "Private channels, DMs, MPIMs, files, broad exports and discovery APIs are not exposed.",
  ),
  blocked(
    "slack_bulk_messaging",
    "Block bulk messaging",
    "Bulk sends, mass DMs and channel-wide mentions are blocked.",
  ),
  blocked(
    "slack_raw_api",
    "Block raw Slack access",
    "Arbitrary Slack methods, raw tokens and unbounded pagination are not exposed.",
  ),
];

export const SLACK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "slack",
  name: "Slack",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.slack.com/authentication/oauth-v2",
  providerWebsiteUrl: "https://slack.com/",
  capabilities: [
    {
      ...capability(
        "conversation_search",
        "List public channels",
        "List bounded public-channel metadata visible to the installed app.",
        true,
      ),
      platformCapability: "conversation_search",
    },
    {
      ...capability(
        "conversation_history_read",
        "Read channel history",
        "Read bounded human-meaningful public-channel or thread context.",
        true,
      ),
      platformCapability: "conversation_history_read",
    },
    {
      ...capability(
        "message_draft",
        "Draft messages",
        "Prepare a Slack message locally without sending it.",
        true,
      ),
      platformCapability: "message_draft",
    },
    {
      ...capability(
        "message_send",
        "Send messages",
        "Send one approval-controlled message to an explicit channel.",
        true,
      ),
      platformCapability: "message_send",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      userInfoUrl: "https://slack.com/api/auth.test",
      requiredScopes: SLACK_REQUIRED_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "SLACK_CLIENT_ID",
        label: "Slack client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Slack app client ID.",
      },
      {
        name: "SLACK_CLIENT_SECRET",
        label: "Slack client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Slack client secret; never sent to agents or stored in the web app.",
      },
    ],
  },
  tools: [
    {
      name: "relay_slack_search_conversations",
      functionName: "relay_slack_search_conversations",
      aliases: ["slack_conversations_list", "slack.conversation.search"],
      capability: "conversation_search",
      platformCapability: "conversation_search",
      action: "read",
      approvalRequired: false,
      description:
        "List at most fifty public Slack channels visible to the app.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", maxLength: 120 },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "relay_slack_read_conversation",
      functionName: "relay_slack_read_conversation",
      aliases: [
        "slack_conversation_history_read",
        "slack.conversation.history.read",
      ],
      capability: "conversation_history_read",
      platformCapability: "conversation_history_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded history from one explicit public channel or thread.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string", pattern: "^[A-Z0-9]{2,32}$" },
          threadTs: { type: "string", pattern: "^[0-9]{1,16}\\.[0-9]{1,16}$" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["channelId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_slack_draft_message",
      functionName: "relay_slack_draft_message",
      aliases: ["slack_message_draft", "slack.message.draft"],
      capability: "message_draft",
      platformCapability: "message_draft",
      action: "draft",
      approvalRequired: false,
      description: "Prepare a bounded Slack message locally.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string", pattern: "^[A-Z0-9]{2,32}$" },
          text: { type: "string", minLength: 1, maxLength: 4000 },
          threadTs: { type: "string", pattern: "^[0-9]{1,16}\\.[0-9]{1,16}$" },
        },
        required: ["channelId", "text"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_slack_send_message",
      functionName: "relay_slack_send_message",
      aliases: ["slack_message_send", "slack.message.send"],
      capability: "message_send",
      platformCapability: "message_send",
      action: "write",
      approvalRequired: true,
      description: "Send one exact approval-controlled Slack message.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string", pattern: "^[A-Z0-9]{2,32}$" },
          text: { type: "string", minLength: 1, maxLength: 4000 },
          threadTs: { type: "string", pattern: "^[0-9]{1,16}\\.[0-9]{1,16}$" },
          idempotencyKey: { type: "string", pattern: "^[A-Za-z0-9_-]{8,64}$" },
          approvalId: { type: "string" },
        },
        required: ["channelId", "text", "idempotencyKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "slack_safe",
      label: "Safe",
      description:
        "Public-channel reads and local drafts run directly; each message send requires matching approval.",
      defaultSelected: true,
      allowedActions: readsAndDraft,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Slack operation supported by this connector runs without Relay per-action approval; workspace ownership, granted scopes, channel membership, fixed methods, request bounds, audits, redaction, Slack limits, and Slack permissions still apply.",
      defaultSelected: false,
      allowedActions: readsAndDraft,
      approvalRequiredActions: writes,
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "workspace_auth",
      label: "Slack workspace and bot authorization",
      requiredScopes: SLACK_REQUIRED_SCOPES,
    },
  ],
};
