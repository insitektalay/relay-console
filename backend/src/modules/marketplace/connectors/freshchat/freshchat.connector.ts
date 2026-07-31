import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const conversationReads = [
  action(
    "freshchat_conversation_get",
    "Read conversation metadata",
    "Read one exact Freshchat conversation through Relay's content-free operational projection.",
  ),
  action(
    "freshchat_message_list",
    "List message metadata",
    "List one fixed first page of content-free message metadata for one exact conversation.",
  ),
];
const fullApi = [
  action(
    "freshchat_full_api",
    "Use Freshchat API v2",
    "Use a documented Freshchat API v2 operation authorized by the connected account API key; Safe mode requires approval.",
  ),
];

export const FRESHCHAT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "freshchat",
  name: "Freshchat",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.freshchat.com/api/",
  providerWebsiteUrl: "https://www.freshworks.com/live-chat-software/",
  capabilities: [
    {
      ...capability(
        "conversation_read",
        "Read conversation operations",
        "Read one exact conversation and bounded message metadata without message content, reply parts, attachments, user profiles, contact details, or custom properties.",
        true,
      ),
      platformCapability: "freshchat_conversation_read",
    },
    {
      ...capability(
        "full_api",
        "Freshchat API v2",
        "Use documented API v2 operations allowed by the connected Freshchat account API key.",
        true,
      ),
      platformCapability: "freshchat_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FRESHCHAT_ACCOUNT_URL",
        label: "Freshchat account URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the HTTPS chat account host shown by Freshchat, ending in .freshchat.com or .myfreshworks.com; omit resource paths.",
      },
      {
        name: "FRESHCHAT_API_KEY",
        label: "Freshchat API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate an API token in Freshchat admin settings. Relay sends it only as a bearer credential to the exact account host.",
      },
    ],
  },
  tools: [
    {
      name: "freshchat.getConversation",
      functionName: "freshchat_conversation_get",
      aliases: ["freshchat.getConversation", "freshchat_conversation_get"],
      capability: "conversation_read",
      platformCapability: "freshchat_conversation_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact conversation's status, priority, routing IDs, and timestamps without messages, users, contact details, or custom properties.",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string", minLength: 1, maxLength: 128 },
        },
        required: ["conversationId"],
        additionalProperties: false,
      },
    },
    {
      name: "freshchat.listMessages",
      functionName: "freshchat_message_list",
      aliases: ["freshchat.listMessages", "freshchat_message_list"],
      capability: "conversation_read",
      platformCapability: "freshchat_conversation_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most fifty message IDs, actor/message types, and timestamps from page one without message or reply content, attachments, users, or actor identities.",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string", minLength: 1, maxLength: 128 },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["conversationId"],
        additionalProperties: false,
      },
    },
    {
      name: "freshchat.request",
      functionName: "freshchat_request",
      aliases: ["freshchat.request", "freshchat_request", "freshchat_full_api"],
      capability: "full_api",
      platformCapability: "freshchat_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Freshchat API v2 method and relative path on the fixed account origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          path: { type: "string", pattern: "^/v2/" },
          query: { type: "object" },
          json: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "freshchat_safe",
      label: "Safe",
      description:
        "Content-free conversation reads and every broader API operation require approval; tenant binding, secret isolation, provider authorization, and limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...conversationReads, ...fullApi],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected API-key-authorized operations run without Relay per-action approval; exact tenant binding, secret isolation, request bounds, audits, provider authorization, and Freshchat limits still apply.",
      defaultSelected: false,
      allowedActions: [...conversationReads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "account_configuration",
      label:
        "Freshchat account URL, API key, authorization, and account configuration check",
    },
  ],
};
