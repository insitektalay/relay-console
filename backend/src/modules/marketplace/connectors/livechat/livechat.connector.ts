import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const chatReads = [
  action(
    "livechat_chat_list",
    "List chat metadata",
    "List one fixed first page of content-free LiveChat operational summaries.",
  ),
  action(
    "livechat_chat_get",
    "Read chat metadata",
    "Read one exact LiveChat through Relay's content-free operational projection.",
  ),
];
const fullApi = [
  action(
    "livechat_full_api",
    "Use Agent Chat API",
    "Use a documented LiveChat Agent Chat API v3.5 action authorized by the connected personal access token; Safe mode requires approval.",
  ),
];

export const LIVECHAT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "livechat",
  name: "LiveChat",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://platform.text.com/docs/messaging/agent-chat-api/v3.5/",
  providerWebsiteUrl: "https://www.livechat.com/",
  capabilities: [
    {
      ...capability(
        "chat_metadata_read",
        "Read chat operations",
        "List and inspect bounded chat/thread operational metadata without messages, events, customer or agent identities, emails, session fields, visits, properties, tags, or attachments.",
        true,
      ),
      platformCapability: "livechat_chat_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Agent Chat API",
        "Use documented Agent Chat API v3.5 actions allowed by the connected LiveChat personal access token.",
        true,
      ),
      platformCapability: "livechat_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LIVECHAT_PERSONAL_ACCESS_TOKEN",
        label: "LiveChat personal access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a personal access token with the minimum chats--access:ro scope for bounded reads. Broader actions require corresponding provider scopes.",
      },
    ],
  },
  tools: [
    {
      name: "livechat.listChats",
      functionName: "livechat_chat_list",
      aliases: ["livechat.listChats", "livechat_chat_list"],
      capability: "chat_metadata_read",
      platformCapability: "livechat_chat_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five newest chat/thread operational summaries without user records, events, messages, properties, tags, or page-token traversal.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "livechat.getChat",
      functionName: "livechat_chat_get",
      aliases: ["livechat.getChat", "livechat_chat_get"],
      capability: "chat_metadata_read",
      platformCapability: "livechat_chat_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact chat's IDs, activity/timing, counts, and group routing without returning users, event content, properties, tags, or attachments.",
      inputSchema: {
        type: "object",
        properties: {
          chatId: { type: "string", minLength: 1, maxLength: 128 },
        },
        required: ["chatId"],
        additionalProperties: false,
      },
    },
    {
      name: "livechat.request",
      functionName: "livechat_request",
      aliases: ["livechat.request", "livechat_request", "livechat_full_api"],
      capability: "full_api",
      platformCapability: "livechat_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented Agent Chat API v3.5 action on the fixed LiveChat origin. URLs, methods, versions, and credential-bearing fields are not accepted from the caller.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            pattern: "^[a-z][a-z0-9_]{0,99}$",
          },
          json: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["action"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "livechat_safe",
      label: "Safe",
      description:
        "Content-free chat reads and every broader Agent Chat action require approval; fixed origin/version, secret isolation, provider scopes, and bounds remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...chatReads, ...fullApi],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected PAT-authorized actions run without Relay per-action approval; fixed origin/version, secret isolation, bounds, audits, provider scopes, and LiveChat limits still apply.",
      defaultSelected: false,
      allowedActions: [...chatReads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "list_chats",
      label:
        "LiveChat personal access token, scope, and bounded chat-list check",
    },
  ],
};
