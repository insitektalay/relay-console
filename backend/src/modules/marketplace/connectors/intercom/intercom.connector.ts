import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const INTERCOM_SCOPES = ["Read conversations", "Read admins"];

const reads = [
  action(
    "intercom_conversation_count",
    "Read conversation count",
    "Read the provider-maintained total conversation count for one Intercom workspace.",
  ),
  action(
    "intercom_conversation_list",
    "List conversations",
    "List at most twenty-five privacy-redacted conversation metadata summaries.",
  ),
  action(
    "intercom_conversation_get",
    "Read conversation metadata",
    "Read one exact privacy-redacted conversation metadata summary by numeric ID.",
  ),
];

const blockedActions = [
  blocked(
    "intercom_conversation_mutation",
    "Change conversations",
    "Replies, notes, assignments, priority changes, open, close, snooze, read-state changes, and deletion are outside V1.",
  ),
  blocked(
    "intercom_private_content",
    "Read private support content",
    "Message bodies, subjects, conversation parts, contacts, teammate identities, attachments, tags, attributes, and translations are outside V1.",
  ),
  blocked(
    "intercom_broader_workspace",
    "Access broader workspace data",
    "Contacts, companies, tickets, admins, teams, articles, webhooks, Fin, reports, settings, and other Intercom products are outside V1.",
  ),
  blocked(
    "intercom_raw_search",
    "Run arbitrary searches",
    "Search queries, arbitrary paths, filters, page cursors, raw responses, and custom API requests are outside V1.",
  ),
  blocked(
    "intercom_bulk_export",
    "Export Intercom data",
    "Automatic pagination, crawling, bulk operations, message delivery exports, and customer-data exports are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const INTERCOM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "intercom",
  name: "Intercom",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/setting-up-oauth",
  providerWebsiteUrl: "https://www.intercom.com/",
  capabilities: [
    {
      ...capability(
        "conversation_read",
        "Read conversation metadata",
        "Read the total conversation count and bounded privacy-redacted conversation metadata in one exact Intercom workspace.",
        true,
      ),
      platformCapability: "intercom_conversation_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.intercom.com/oauth",
      tokenUrl: "https://api.intercom.io/auth/eagle/token",
      requiredScopes: INTERCOM_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
      revocationUrl: "https://api.intercom.io/auth/uninstall",
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "intercom.conversationCount",
      functionName: "intercom_conversation_count",
      aliases: ["intercom.conversationCount", "intercom_conversation_count"],
      capability: "conversation_read",
      platformCapability: "intercom_conversation_read",
      action: "read",
      approvalRequired: true,
      description: "Read the total number of conversations in the workspace.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "intercom.listConversations",
      functionName: "intercom_conversation_list",
      aliases: ["intercom.listConversations", "intercom_conversation_list"],
      capability: "conversation_read",
      platformCapability: "intercom_conversation_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five privacy-redacted conversation metadata summaries.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "intercom.getConversation",
      functionName: "intercom_conversation_get",
      aliases: ["intercom.getConversation", "intercom_conversation_get"],
      capability: "conversation_read",
      platformCapability: "intercom_conversation_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact privacy-redacted conversation metadata summary.",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
          approvalId,
        },
        required: ["conversationId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "intercom_safe",
      label: "Safe",
      description:
        "All three bounded conversation metadata reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact workspace, region, and verified-admin binding, Intercom-granted permissions, fixed requests, limits, audit, redaction, provider revocation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "current-admin",
      label:
        "Intercom authorization, exact workspace, region, and verified authorizing-admin validation",
      requiredScopes: INTERCOM_SCOPES,
    },
  ],
};
