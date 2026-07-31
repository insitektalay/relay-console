import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "zoho_campaigns_campaign_list",
    "List recent campaigns",
    "List at most twenty-five recent campaign summaries from the first result page.",
  ),
  action(
    "zoho_campaigns_campaign_report",
    "Read aggregate campaign report",
    "Read bounded aggregate delivery and engagement metrics for one exact campaign key.",
  ),
];

export const ZOHO_CAMPAIGNS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoho-campaigns",
  name: "Zoho Campaigns",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.zoho.com/campaigns/help/developers/",
  providerWebsiteUrl: "https://www.zoho.com/campaigns/",
  capabilities: [
    {
      ...capability(
        "campaign_summary_read",
        "Read campaign summaries and aggregate reports",
        "Read bounded recent-campaign metadata and aggregate delivery metrics without contacts, recipients, sender addresses, content, writes, or raw responses.",
        true,
      ),
      platformCapability: "zoho_campaigns_summary_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      revocationUrl: "https://accounts.zoho.com/oauth/v2/token/revoke",
      userInfoUrl: "https://accounts.zoho.com/oauth/user/info",
      requiredScopes: ["AaaServer.profile.Read", "ZohoCampaigns.campaign.READ"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ZOHO_CAMPAIGNS_CLIENT_ID",
        label: "Zoho Campaigns client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned multi-data-center Zoho web client ID configured on Railway.",
      },
      {
        name: "ZOHO_CAMPAIGNS_CLIENT_SECRET",
        label: "Zoho Campaigns client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned shared multi-data-center Zoho client secret stored only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "zohoCampaigns.listRecentCampaigns",
      functionName: "zoho_campaigns_campaign_list",
      aliases: [
        "zohoCampaigns.listRecentCampaigns",
        "zoho_campaigns_campaign_list",
      ],
      capability: "campaign_summary_read",
      platformCapability: "zoho_campaigns_summary_read",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded first page of recent campaigns with key, name, status, and creation time only.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: [
              "all",
              "drafts",
              "scheduled",
              "inprogress",
              "sent",
              "stopped",
              "canceled",
              "tobereviewed",
              "reviewed",
              "paused",
              "intesting",
            ],
          },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "zohoCampaigns.getCampaignReport",
      functionName: "zoho_campaigns_campaign_report",
      aliases: [
        "zohoCampaigns.getCampaignReport",
        "zoho_campaigns_campaign_report",
      ],
      capability: "campaign_summary_read",
      platformCapability: "zoho_campaigns_summary_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read aggregate counts and percentages for one exact campaign key while stripping sender, recipient, subject, content, location, and raw report fields.",
      inputSchema: {
        type: "object",
        properties: {
          campaignKey: { type: "string", pattern: "^[A-Za-z0-9]{1,100}$" },
        },
        required: ["campaignKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoho_campaigns_safe",
      label: "Safe",
      description:
        "Both bounded campaign-summary reads require approval; contacts, recipient activity, sender identity, content, and mutations remain outside V1.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The selected reads run without Relay per-action approval; exact user, regional origin, scope, result bounds, audits, and privacy exclusions remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "current-user-region-and-campaign-read-scope",
      label:
        "Zoho current user, regional Campaigns API, and campaign-read scope",
      requiredScopes: ["AaaServer.profile.Read", "ZohoCampaigns.campaign.READ"],
    },
  ],
};
