import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "telegram_bot_read_identity",
    "Read bot identity",
    "Read the connected bot's bounded public identity and webhook status.",
  ),
  action(
    "telegram_bot_read_chat",
    "Read allowed chat",
    "Read metadata for one exact chat in the connection allowlist.",
  ),
  action(
    "telegram_bot_read_updates",
    "Read bounded updates",
    "Read at most 100 queued updates and return only chats in the connection allowlist.",
  ),
];
const writes = [
  action(
    "telegram_bot_send_message",
    "Send message",
    "Send one bounded text message to an allowed chat.",
  ),
  action(
    "telegram_bot_edit_message",
    "Edit message",
    "Edit one exact bot message in an allowed chat.",
  ),
  action(
    "telegram_bot_delete_message",
    "Delete message",
    "Delete one exact message in an allowed chat.",
  ),
];
const blockedActions = [
  blocked(
    "telegram_bot_personal_account",
    "Act as a personal Telegram account",
    "The Bot API token authorizes only its bot identity and never a person's Telegram account, phone login, sessions, contacts, history, or Saved Messages.",
  ),
  blocked(
    "telegram_bot_token_exposure",
    "Expose bot credentials",
    "The bot token remains encrypted and is injected only into fixed-origin Telegram Bot API requests.",
  ),
  blocked(
    "telegram_bot_unapproved_chat",
    "Access chats outside the allowlist",
    "Every chat-specific read or write must match one exact configured chat ID or channel username.",
  ),
  blocked(
    "telegram_bot_raw_admin_api",
    "Call raw or administrative APIs",
    "Raw methods, webhook changes, bot configuration, administrators, invite links, payments, games, Stars, files, broadcasts, bans, promotions, forum administration, business connections and account management are unavailable.",
  ),
  blocked(
    "telegram_bot_unbounded_polling",
    "Poll or export without bounds",
    "Long polling, continuous ingestion, unbounded history, bulk export and update delivery beyond 100 queued items are unavailable.",
  ),
  blocked(
    "telegram_bot_spam",
    "Spam or harass users",
    "Unsolicited messaging, bulk broadcasts, deceptive behavior, impersonation and requests for passwords or one-time codes are prohibited.",
  ),
];

const chatId = { type: "string", minLength: 1, maxLength: 64 };
const messageId = { type: "number", minimum: 1 };

export const TELEGRAM_PERSONAL_BOTS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "telegram-personal-bots",
    name: "Telegram Personal Bots",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://core.telegram.org/bots/api",
    providerWebsiteUrl: "https://telegram.org/",
    capabilities: [
      {
        ...capability(
          "bot_identity",
          "Bot identity",
          "Read the connected bot's identity and webhook delivery status.",
          true,
        ),
        platformCapability: "telegram_bot_identity",
      },
      {
        ...capability(
          "allowed_chat_read",
          "Allowed chat reads",
          "Read exact allowed-chat metadata and bounded queued updates.",
          true,
        ),
        platformCapability: "telegram_bot_chat_read",
      },
      {
        ...capability(
          "message_send",
          "Send messages",
          "Send bounded text messages only to configured chats.",
          true,
        ),
        platformCapability: "telegram_bot_message_send",
      },
      {
        ...capability(
          "message_manage",
          "Manage messages",
          "Edit or delete one exact message in a configured chat.",
          false,
        ),
        platformCapability: "telegram_bot_message_manage",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "TELEGRAM_BOT_TOKEN",
          label: "Telegram bot token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Create or select your dedicated bot in @BotFather and paste its token. Anyone holding this token controls the bot.",
        },
        {
          name: "TELEGRAM_ALLOWED_CHAT_IDS",
          label: "Allowed Telegram chat IDs",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Comma-separated exact numeric chat IDs or @channel usernames, maximum 100. Relay rejects all other chats.",
        },
      ],
    },
    tools: [
      {
        name: "telegramPersonalBots.getMe",
        functionName: "telegram_personal_bots_get_me",
        aliases: [
          "telegramPersonalBots.getMe",
          "telegram_personal_bots_get_me",
        ],
        capability: "bot_identity",
        platformCapability: "telegram_bot_identity",
        action: "read",
        approvalRequired: false,
        description:
          "Read the connected Telegram bot's bounded public identity.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "telegramPersonalBots.getWebhookInfo",
        functionName: "telegram_personal_bots_get_webhook_info",
        aliases: [
          "telegramPersonalBots.getWebhookInfo",
          "telegram_personal_bots_get_webhook_info",
        ],
        capability: "bot_identity",
        platformCapability: "telegram_bot_identity",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded webhook delivery status without changing it.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "telegramPersonalBots.getChat",
        functionName: "telegram_personal_bots_get_chat",
        aliases: [
          "telegramPersonalBots.getChat",
          "telegram_personal_bots_get_chat",
        ],
        capability: "allowed_chat_read",
        platformCapability: "telegram_bot_chat_read",
        action: "read",
        approvalRequired: false,
        description: "Read metadata for one exact allowed chat.",
        inputSchema: {
          type: "object",
          properties: { chatId },
          required: ["chatId"],
          additionalProperties: false,
        },
      },
      {
        name: "telegramPersonalBots.getUpdates",
        functionName: "telegram_personal_bots_get_updates",
        aliases: [
          "telegramPersonalBots.getUpdates",
          "telegram_personal_bots_get_updates",
        ],
        capability: "allowed_chat_read",
        platformCapability: "telegram_bot_chat_read",
        action: "read",
        approvalRequired: false,
        description:
          "Perform one bounded short poll and return queued updates only for allowed chats.",
        inputSchema: {
          type: "object",
          properties: {
            offset: { type: "number" },
            limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "telegramPersonalBots.sendMessage",
        functionName: "telegram_personal_bots_send_message",
        aliases: [
          "telegramPersonalBots.sendMessage",
          "telegram_personal_bots_send_message",
        ],
        capability: "message_send",
        platformCapability: "telegram_bot_message_send",
        action: "write",
        approvalRequired: true,
        description: "Send one bounded plain-text message to an allowed chat.",
        inputSchema: {
          type: "object",
          properties: {
            chatId,
            text: { type: "string", minLength: 1, maxLength: 4096 },
            disableNotification: { type: "boolean", default: false },
            protectContent: { type: "boolean", default: true },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["chatId", "text"],
          additionalProperties: false,
        },
      },
      {
        name: "telegramPersonalBots.editMessageText",
        functionName: "telegram_personal_bots_edit_message_text",
        aliases: [
          "telegramPersonalBots.editMessageText",
          "telegram_personal_bots_edit_message_text",
        ],
        capability: "message_manage",
        platformCapability: "telegram_bot_message_manage",
        action: "write",
        approvalRequired: true,
        description: "Edit one exact bot message in an allowed chat.",
        inputSchema: {
          type: "object",
          properties: {
            chatId,
            messageId,
            text: { type: "string", minLength: 1, maxLength: 4096 },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["chatId", "messageId", "text"],
          additionalProperties: false,
        },
      },
      {
        name: "telegramPersonalBots.deleteMessage",
        functionName: "telegram_personal_bots_delete_message",
        aliases: [
          "telegramPersonalBots.deleteMessage",
          "telegram_personal_bots_delete_message",
        ],
        capability: "message_manage",
        platformCapability: "telegram_bot_message_manage",
        action: "write",
        approvalRequired: true,
        description: "Delete one exact message in an allowed chat.",
        inputSchema: {
          type: "object",
          properties: {
            chatId,
            messageId,
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["chatId", "messageId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "telegram_personal_bots_safe",
        label: "Safe",
        description:
          "Bounded bot identity and allowed-chat reads run directly; every send, edit and delete requires approval.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: writes,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Selected sends, edits and deletes run without Relay per-action approval; bot identity, chat allowlist, fixed API origin, bounds, secret isolation, audits and Telegram terms still apply.",
        defaultSelected: false,
        allowedActions: [...reads, ...writes],
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "bot_identity",
        label: "Telegram Bot API token and bot identity check",
      },
    ],
  };
