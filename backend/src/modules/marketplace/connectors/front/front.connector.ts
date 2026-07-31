import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "front_conversation_list",
    "List conversations",
    "List at most twenty-five privacy-redacted conversation metadata summaries.",
  ),
  action(
    "front_conversation_get",
    "Read conversation metadata",
    "Read one privacy-redacted conversation metadata summary by Front conversation ID.",
  ),
];

const fullApi = [
  action(
    "front_full_api",
    "Use full Front API",
    "Use any documented Front Core API operation authorized by the OAuth app; Safe mode requires approval.",
  ),
];

export const FRONT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "front",
  name: "Front",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://dev.frontapp.com/docs/oauth",
  providerWebsiteUrl: "https://front.com/",
  capabilities: [
    {
      ...capability(
        "conversation_read",
        "Read conversation metadata",
        "Read bounded privacy-redacted conversation metadata in the connected Front company.",
        true,
      ),
      platformCapability: "front_conversation_read",
    },
    {
      ...capability(
        "full_api",
        "Full Front Core API",
        "Use the complete documented Front Core API surface allowed by the OAuth app and connected company.",
        true,
      ),
      platformCapability: "front_full_api",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.frontapp.com/oauth/authorize",
      tokenUrl: "https://app.frontapp.com/oauth/token",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "front.listConversations",
      functionName: "front_conversation_list",
      aliases: ["front.listConversations", "front_conversation_list"],
      capability: "conversation_read",
      platformCapability: "front_conversation_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five privacy-redacted Front conversation metadata summaries.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "front.getConversation",
      functionName: "front_conversation_get",
      aliases: ["front.getConversation", "front_conversation_get"],
      capability: "conversation_read",
      platformCapability: "front_conversation_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact privacy-redacted Front conversation metadata summary.",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: {
            type: "string",
            pattern: "^cnv_[A-Za-z0-9_-]{1,190}$",
          },
        },
        required: ["conversationId"],
        additionalProperties: false,
      },
    },
    {
      name: "front.request",
      functionName: "front_request",
      aliases: ["front.request", "front_request", "front_full_api"],
      capability: "full_api",
      platformCapability: "front_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Front Core API method and path on the fixed api2.frontapp.com origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          path: { type: "string", pattern: "^/" },
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
      id: "front_safe",
      label: "Safe",
      description:
        "Bounded privacy-redacted conversation reads run directly; every other Front API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Front operation runs without Relay per-action approval; company binding, secret isolation, request bounds, audits, provider permissions, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "token-identity",
      label: "Front authorization and exact company validation",
    },
  ],
};
