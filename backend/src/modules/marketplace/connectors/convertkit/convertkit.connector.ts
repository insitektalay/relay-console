import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const CONVERTKIT_SCOPES = ["public"];

const reads = [
  action(
    "convertkit_account_get",
    "Read account metadata",
    "Read the exact Kit account ID, name, plan, creation time, and timezone name.",
  ),
  action(
    "convertkit_form_list_active",
    "List active forms",
    "Read one fixed page of twenty active Form lifecycle summaries.",
  ),
  action(
    "convertkit_broadcast_list_recent",
    "List recent broadcasts",
    "Read one fixed page of twenty sparse Broadcast lifecycle summaries.",
  ),
];

const blockedActions = [
  blocked(
    "convertkit_subscriber_private",
    "Access subscribers or audience identity",
    "Subscribers, contact identity, custom fields, tags, segments, consent, and behavior are outside V1.",
  ),
  blocked(
    "convertkit_content_private",
    "Access content or audience details",
    "Form subscriber data and embed URLs plus Broadcast subjects, content, previews, descriptions, email identity, templates, filters, audiences, and statistics are outside V1.",
  ),
  blocked(
    "convertkit_commerce_automation",
    "Access commerce or automation",
    "Purchases, commerce, automations, sequences, and webhooks are outside V1.",
  ),
  blocked(
    "convertkit_marketing_mutation",
    "Change or send Kit data",
    "Creating, updating, sending, subscribing, tagging, importing, bulk processing, or deleting Kit resources is outside V1.",
  ),
  blocked(
    "convertkit_raw_query",
    "Run arbitrary requests",
    "Arbitrary paths, query parameters, cursors, pagination, crawling, synchronization, exports, and raw API access are outside V1.",
  ),
];

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const CONVERTKIT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "convertkit",
  name: "Kit",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.kit.com/api-reference/authentication",
  providerWebsiteUrl: "https://kit.com/",
  capabilities: [
    {
      ...capability(
        "account_metadata",
        "Account metadata",
        "Read the exact Kit account summary.",
        true,
      ),
      platformCapability: "convertkit_account_read",
    },
    {
      ...capability(
        "form_metadata",
        "Active Form metadata",
        "List bounded active Form lifecycle summaries.",
        true,
      ),
      platformCapability: "convertkit_form_read",
    },
    {
      ...capability(
        "broadcast_metadata",
        "Broadcast metadata",
        "List bounded recent Broadcast lifecycle summaries.",
        true,
      ),
      platformCapability: "convertkit_broadcast_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.kit.com/v4/oauth/authorize",
      tokenUrl: "https://api.kit.com/v4/oauth/token",
      refreshUrl: "https://api.kit.com/v4/oauth/token",
      requiredScopes: CONVERTKIT_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "convertkit.getAccount",
      functionName: "convertkit_account_get",
      aliases: ["convertkit.getAccount", "convertkit_account_get"],
      capability: "account_metadata",
      platformCapability: "convertkit_account_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read the bound Kit account ID, name, plan, creation time, and timezone name.",
      inputSchema: emptySchema,
    },
    {
      name: "convertkit.listActiveForms",
      functionName: "convertkit_form_list_active",
      aliases: ["convertkit.listActiveForms", "convertkit_form_list_active"],
      capability: "form_metadata",
      platformCapability: "convertkit_form_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty active Form lifecycle summaries without embed URLs or subscriber data.",
      inputSchema: emptySchema,
    },
    {
      name: "convertkit.listRecentBroadcasts",
      functionName: "convertkit_broadcast_list_recent",
      aliases: [
        "convertkit.listRecentBroadcasts",
        "convertkit_broadcast_list_recent",
      ],
      capability: "broadcast_metadata",
      platformCapability: "convertkit_broadcast_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty sparse Broadcast lifecycle summaries without content, identity, audiences, templates, or statistics.",
      inputSchema: emptySchema,
    },
  ],
  approvalProfiles: [
    {
      id: "convertkit_safe",
      label: "Safe",
      description:
        "Three bounded metadata-only reads run automatically; subscribers, identity, content, audiences, commerce, automation, raw requests, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact-account binding, fixed fields, page limits, audit, redaction, serialized token rotation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "account",
      label:
        "Kit OAuth, exact account, public scope, and rotating token-pair validation",
      requiredScopes: CONVERTKIT_SCOPES,
    },
  ],
};
