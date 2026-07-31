import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "help_scout_conversation_count",
    "Read conversation count",
    "Read the provider-maintained total conversation count.",
  ),
  action(
    "help_scout_conversation_list",
    "List conversations",
    "List at most twenty-five privacy-redacted conversation metadata summaries.",
  ),
  action(
    "help_scout_conversation_get",
    "Read conversation metadata",
    "Read one privacy-redacted conversation metadata summary by numeric ID.",
  ),
];

const fullApi = [
  action(
    "help_scout_full_api",
    "Use full Help Scout API",
    "Use any documented Help Scout Mailbox API operation authorized by the connected user; Safe mode requires approval.",
  ),
];

export const HELP_SCOUT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "help-scout",
  name: "Help Scout",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.helpscout.com/mailbox-api/overview/authentication/",
  providerWebsiteUrl: "https://www.helpscout.com/",
  capabilities: [
    {
      ...capability(
        "conversation_read",
        "Read conversation metadata",
        "Read the conversation count and bounded privacy-redacted conversation metadata in the connected Help Scout account.",
        true,
      ),
      platformCapability: "help_scout_conversation_read",
    },
    {
      ...capability(
        "full_api",
        "Full Help Scout Mailbox API",
        "Use the complete documented Help Scout Mailbox API surface allowed by the authorizing user's role.",
        true,
      ),
      platformCapability: "help_scout_full_api",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://secure.helpscout.net/authentication/authorizeClientApplication",
      tokenUrl: "https://api.helpscout.net/v2/oauth2/token",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "helpScout.conversationCount",
      functionName: "help_scout_conversation_count",
      aliases: [
        "helpScout.conversationCount",
        "help_scout_conversation_count",
      ],
      capability: "conversation_read",
      platformCapability: "help_scout_conversation_read",
      action: "read",
      approvalRequired: false,
      description: "Read the total number of Help Scout conversations.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "helpScout.listConversations",
      functionName: "help_scout_conversation_list",
      aliases: ["helpScout.listConversations", "help_scout_conversation_list"],
      capability: "conversation_read",
      platformCapability: "help_scout_conversation_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five privacy-redacted conversation metadata summaries.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "helpScout.getConversation",
      functionName: "help_scout_conversation_get",
      aliases: ["helpScout.getConversation", "help_scout_conversation_get"],
      capability: "conversation_read",
      platformCapability: "help_scout_conversation_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact privacy-redacted Help Scout conversation metadata summary.",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
        },
        required: ["conversationId"],
        additionalProperties: false,
      },
    },
    {
      name: "helpScout.request",
      functionName: "help_scout_request",
      aliases: ["helpScout.request", "help_scout_request", "help_scout_full_api"],
      capability: "full_api",
      platformCapability: "help_scout_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Help Scout Mailbox API method and path on the fixed api.helpscout.net origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
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
      id: "help_scout_safe",
      label: "Safe",
      description:
        "Bounded privacy-redacted conversation reads run directly; every other Help Scout API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Help Scout operation runs without Relay per-action approval; connection ownership, exact user binding, secret isolation, request bounds, audits, provider roles, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "current-user",
      label: "Help Scout authorization and exact authorizing-user validation",
    },
  ],
};
