import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const KLAVIYO_SCOPES = ["accounts:read", "lists:read", "campaigns:read"];
export const KLAVIYO_API_REVISION = "2026-04-15";

const reads = [
  action(
    "klaviyo_account_get",
    "Read account metadata",
    "Read the exact account ID, name, timezone, and currency.",
  ),
  action(
    "klaviyo_list_list_recent",
    "List recent lists",
    "Read one fixed page of ten recently updated List lifecycle summaries.",
  ),
  action(
    "klaviyo_campaign_list_recent_email",
    "List recent email campaigns",
    "Read one fixed page of twenty-five email Campaign lifecycle summaries.",
  ),
];

const blockedActions = [
  blocked(
    "klaviyo_profile_private",
    "Access profiles or behavior",
    "Profiles, contact identity, consent, events, metrics, and behavioral data are outside V1.",
  ),
  blocked(
    "klaviyo_campaign_content",
    "Access campaign content or audiences",
    "Campaign names, messages, content, audiences, recipients, reports, tags, and tracking are outside V1.",
  ),
  blocked(
    "klaviyo_marketing_mutation",
    "Change or send Klaviyo data",
    "Creating, updating, ingesting, sending, archiving, or deleting Klaviyo resources is outside V1.",
  ),
  blocked(
    "klaviyo_broader_api",
    "Access broader Klaviyo APIs",
    "Flows, templates, catalogs, commerce, forms, images, coupons, webhooks, and administration are outside V1.",
  ),
  blocked(
    "klaviyo_raw_query",
    "Run arbitrary requests",
    "Arbitrary paths, filters, includes, additional fields, revisions, cursors, pagination, crawling, synchronization, exports, and raw API access are outside V1.",
  ),
];

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const KLAVIYO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "klaviyo",
  name: "Klaviyo",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.klaviyo.com/en/reference/api_overview",
  providerWebsiteUrl: "https://www.klaviyo.com/",
  capabilities: [
    {
      ...capability(
        "account_metadata",
        "Account metadata",
        "Read the exact Klaviyo Account summary.",
        true,
      ),
      platformCapability: "klaviyo_account_read",
    },
    {
      ...capability(
        "list_metadata",
        "List metadata",
        "List bounded recently updated List lifecycle summaries.",
        true,
      ),
      platformCapability: "klaviyo_list_read",
    },
    {
      ...capability(
        "campaign_metadata",
        "Email Campaign metadata",
        "List bounded recent email Campaign lifecycle summaries.",
        true,
      ),
      platformCapability: "klaviyo_campaign_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.klaviyo.com/oauth/authorize",
      tokenUrl: "https://a.klaviyo.com/oauth/token",
      refreshUrl: "https://a.klaviyo.com/oauth/token",
      revocationUrl: "https://a.klaviyo.com/oauth/revoke",
      requiredScopes: KLAVIYO_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "klaviyo.getAccount",
      functionName: "klaviyo_account_get",
      aliases: ["klaviyo.getAccount", "klaviyo_account_get"],
      capability: "account_metadata",
      platformCapability: "klaviyo_account_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read the bound Klaviyo Account ID, name, timezone, and currency.",
      inputSchema: emptySchema,
    },
    {
      name: "klaviyo.listRecentLists",
      functionName: "klaviyo_list_list_recent",
      aliases: ["klaviyo.listRecentLists", "klaviyo_list_list_recent"],
      capability: "list_metadata",
      platformCapability: "klaviyo_list_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of ten sparse List lifecycle summaries, recently updated first.",
      inputSchema: emptySchema,
    },
    {
      name: "klaviyo.listRecentEmailCampaigns",
      functionName: "klaviyo_campaign_list_recent_email",
      aliases: [
        "klaviyo.listRecentEmailCampaigns",
        "klaviyo_campaign_list_recent_email",
      ],
      capability: "campaign_metadata",
      platformCapability: "klaviyo_campaign_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty-five sparse email Campaign lifecycle summaries, recently updated first.",
      inputSchema: emptySchema,
    },
  ],
  approvalProfiles: [
    {
      id: "klaviyo_safe",
      label: "Safe",
      description:
        "Three bounded metadata-only reads run automatically; profiles, behavior, campaign content, broader APIs, raw requests, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact-account and scope binding, the pinned revision, sparse fields, page limits, audit, redaction, token rotation, and provider limits remain enforced.",
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
        "Klaviyo OAuth, exact account, least scopes, rotating token pair, and pinned API revision validation",
      requiredScopes: KLAVIYO_SCOPES,
    },
  ],
};
