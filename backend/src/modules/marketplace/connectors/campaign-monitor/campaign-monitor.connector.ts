import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const CAMPAIGN_MONITOR_SCOPES = ["ViewReports"];

const reads = [
  action(
    "campaign_monitor_client_get",
    "Read selected Client",
    "Read only the exact bound Campaign Monitor Client ID and name.",
  ),
  action(
    "campaign_monitor_campaign_list_recent_sent",
    "List recent sent Campaigns",
    "Read page one of twenty recent sent Campaign IDs and dates, newest first.",
  ),
  action(
    "campaign_monitor_campaign_summary_get",
    "Read Campaign aggregate summary",
    "Read aggregate delivery, open, click, bounce, unsubscribe, spam, forward, like, and mention counts for one Campaign from the bounded list.",
  ),
];

const blockedActions = [
  blocked(
    "campaign_monitor_subscriber_private",
    "Access subscribers or person-level reports",
    "Subscriber identity, lists, segments, contact fields, consent, recipients, opens, clicks, locations, and drilldowns are outside V1.",
  ),
  blocked(
    "campaign_monitor_campaign_content",
    "Access Campaign content or identity",
    "Campaign names, subjects, sender and reply identity, message content, URLs, links, tags, recipients, and audience detail are outside V1.",
  ),
  blocked(
    "campaign_monitor_broader_api",
    "Access broader Campaign Monitor APIs",
    "Transactional messages, journeys, templates, account administration, people, billing, and broader Client resources are outside V1.",
  ),
  blocked(
    "campaign_monitor_marketing_mutation",
    "Change or send Campaign Monitor data",
    "Creating, importing, updating, sending, administering, or deleting Campaign Monitor resources is outside V1.",
  ),
  blocked(
    "campaign_monitor_raw_query",
    "Run arbitrary requests",
    "Arbitrary Clients, dates, tags, pages, page sizes, sort directions, paths, pagination, crawling, exports, and raw API access are outside V1.",
  ),
];

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const CAMPAIGN_MONITOR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "campaign-monitor",
    name: "Campaign Monitor",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://www.campaignmonitor.com/api/v3-3/getting-started/",
    providerWebsiteUrl: "https://www.campaignmonitor.com/",
    capabilities: [
      {
        ...capability(
          "client_metadata",
          "Selected Client metadata",
          "Read the exact selected Campaign Monitor Client summary.",
          true,
        ),
        platformCapability: "campaign_monitor_client_read",
      },
      {
        ...capability(
          "campaign_metadata",
          "Sent Campaign metadata",
          "List bounded recent sent Campaign lifecycle summaries.",
          true,
        ),
        platformCapability: "campaign_monitor_campaign_read",
      },
      {
        ...capability(
          "campaign_summary",
          "Campaign aggregate summary",
          "Read privacy-minimized aggregate reporting counts for one bounded Campaign.",
          true,
        ),
        platformCapability: "campaign_monitor_report_read",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://api.createsend.com/oauth",
        tokenUrl: "https://api.createsend.com/oauth/token",
        refreshUrl: "https://api.createsend.com/oauth/token",
        requiredScopes: CAMPAIGN_MONITOR_SCOPES,
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    },
    tools: [
      {
        name: "campaign-monitor.getClient",
        functionName: "campaign_monitor_client_get",
        aliases: ["campaign-monitor.getClient", "campaign_monitor_client_get"],
        capability: "client_metadata",
        platformCapability: "campaign_monitor_client_read",
        action: "read",
        approvalRequired: false,
        description: "Read only the exact bound Client ID and name.",
        inputSchema: emptySchema,
      },
      {
        name: "campaign-monitor.listRecentSentCampaigns",
        functionName: "campaign_monitor_campaign_list_recent_sent",
        aliases: [
          "campaign-monitor.listRecentSentCampaigns",
          "campaign_monitor_campaign_list_recent_sent",
        ],
        capability: "campaign_metadata",
        platformCapability: "campaign_monitor_campaign_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read page one of twenty recent sent Campaign IDs and dates, newest first.",
        inputSchema: emptySchema,
      },
      {
        name: "campaign-monitor.getCampaignSummary",
        functionName: "campaign_monitor_campaign_summary_get",
        aliases: [
          "campaign-monitor.getCampaignSummary",
          "campaign_monitor_campaign_summary_get",
        ],
        capability: "campaign_summary",
        platformCapability: "campaign_monitor_report_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read aggregate reporting counts for one 32-hex Campaign ID from the current bounded sent-Campaign list.",
        inputSchema: {
          type: "object",
          properties: {
            campaignId: {
              type: "string",
              pattern: "^[A-Fa-f0-9]{32}$",
            },
          },
          required: ["campaignId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "campaign_monitor_safe",
        label: "Safe",
        description:
          "Three bounded reporting reads run automatically; subscriber identity, person-level reports, content, broader APIs, raw requests, exports, and writes stay blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same three read-only tools run while exact-Client binding, ViewReports-only authority, bounded Campaign membership, fixed fields, page limits, audit, redaction, and token rotation remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "client",
        label:
          "Campaign Monitor OAuth, exact visible Client, ViewReports, and rotating token-pair validation",
        requiredScopes: CAMPAIGN_MONITOR_SCOPES,
      },
    ],
  };
