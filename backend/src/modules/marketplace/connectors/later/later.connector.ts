import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "later_instance_id_list",
    "List Later Influence instance IDs",
    "List the first 25 instance IDs bound to the connected Reporting API client.",
  ),
  action(
    "later_instance_performance_get",
    "Get aggregate Later Influence performance",
    "Read fixed aggregate engagement, impression, and reach metrics for an exact date window of at most 31 days.",
  ),
  action(
    "later_campaign_performance_list",
    "List Later Influence campaign performance",
    "List at most 25 campaign IDs with fixed engagement, impression, and reach metrics for an exact instance and date window of at most 31 days.",
  ),
];
const blockedActions = [
  blocked(
    "later_identity_or_content",
    "Read creator identity or social content",
    "Creator names, handles, audience data, post text, URLs, media, campaign names, and other identity or content are outside V1.",
  ),
  blocked(
    "later_financial_or_conversion",
    "Read financial or conversion analytics",
    "Cost, spend, ROI, paid-media, tracking-link, affiliate, sales, and conversion metrics are outside V1.",
  ),
  blocked(
    "later_social_management",
    "Manage Later Social",
    "Scheduling, publishing, media-library, Link in Bio, Inbox, social-profile, team, and account operations are outside the documented Reporting API and V1.",
  ),
  blocked(
    "later_raw_or_bulk",
    "Use arbitrary Later APIs",
    "Arbitrary paths, metrics, filters, sorting, cursors, pagination, raw responses, broad sync, and export are outside V1.",
  ),
];
const dateInput = {
  type: "object",
  required: ["startDate", "endDate"],
  properties: {
    startDate: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
    endDate: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
  },
  additionalProperties: false,
};

export const LATER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "later",
  name: "Later",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.reporting.api.later.com/",
  providerWebsiteUrl: "https://later.com/",
  capabilities: [
    {
      ...capability(
        "influence_analytics_read",
        "Read bounded influence analytics",
        "Read identity- and content-free Later Influence instance and campaign performance metadata.",
        true,
      ),
      platformCapability: "later_influence_analytics_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LATER_CLIENT_ID",
        label: "Later Reporting API client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use customer-owned Later Influence Reporting API credentials provided by the account team.",
      },
      {
        name: "LATER_CLIENT_SECRET",
        label: "Later Reporting API client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Relay encrypts the customer-owned secret and uses it only server-side.",
      },
    ],
  },
  tools: [
    {
      name: "later.listInstanceIds",
      functionName: "later_instance_id_list",
      aliases: ["later.listInstanceIds", "later_instance_id_list"],
      capability: "influence_analytics_read",
      platformCapability: "later_influence_analytics_read",
      action: "read",
      approvalRequired: true,
      description: "List at most 25 token-bound Later Influence instance IDs.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "later.getInstancePerformance",
      functionName: "later_instance_performance_get",
      aliases: [
        "later.getInstancePerformance",
        "later_instance_performance_get",
      ],
      capability: "influence_analytics_read",
      platformCapability: "later_influence_analytics_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read aggregate engagements, impressions, and reach for a date window of at most 31 days.",
      inputSchema: dateInput,
    },
    {
      name: "later.listCampaignPerformance",
      functionName: "later_campaign_performance_list",
      aliases: [
        "later.listCampaignPerformance",
        "later_campaign_performance_list",
      ],
      capability: "influence_analytics_read",
      platformCapability: "later_influence_analytics_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most 25 campaign IDs and fixed metrics for one exact instance and date window.",
      inputSchema: {
        type: "object",
        required: ["instanceId", "startDate", "endDate"],
        properties: {
          instanceId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,200}$" },
          startDate: dateInput.properties.startDate,
          endDate: dateInput.properties.endDate,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "later_safe",
      label: "Safe",
      description:
        "All three reporting reads require approval; identity, content, financial/conversion analytics, social management, arbitrary APIs, pagination, and export remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three reads run directly; fixed origins, fixed metrics, redaction, date and result bounds, audits, and provider rate limits remain mandatory.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "client_credentials",
      label:
        "Later customer-owned Reporting API credentials can list instance IDs",
      requiredScopes: [],
    },
  ],
};
