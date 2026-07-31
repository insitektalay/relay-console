import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const BRAZE_PERMISSIONS = [
  "campaigns.list",
  "campaigns.data_series",
  "canvas.list",
];

const reads = [
  action(
    "braze_campaign_list_recent",
    "List recent campaigns",
    "Read the newest unarchived Campaign page and return at most twenty-five content-free lifecycle summaries.",
  ),
  action(
    "braze_canvas_list_recent",
    "List recent Canvases",
    "Read the newest unarchived Canvas page and return at most twenty-five content-free lifecycle summaries.",
  ),
  action(
    "braze_campaign_analytics_get",
    "Read campaign analytics",
    "Read a fixed seven-day top-level aggregate series for one Campaign proven to belong to the bounded Campaign page.",
  ),
];

const blockedActions = [
  blocked(
    "braze_people_private",
    "Access users or audiences",
    "Users, identifiers, attributes, devices, events, purchases, sessions, segments, audience membership, and profile exports are outside V1.",
  ),
  blocked(
    "braze_content_private",
    "Access content or detailed reports",
    "Campaign/Canvas names, tags, descriptions, message variations, bodies, subjects, URLs, recipients, channel/variation drilldowns, and Currents data are outside V1.",
  ),
  blocked(
    "braze_mutation",
    "Change or send Braze data",
    "Tracking, identifying, merging, creating, updating, deleting, triggering, sending, scheduling, and administering Braze resources are outside V1.",
  ),
  blocked(
    "braze_broader_api",
    "Access broader Braze APIs",
    "Catalogs, Cloud Data Ingestion, email/SMS status, templates, content blocks, preference centers, SCIM, SDK authentication, and broader export APIs are outside V1.",
  ),
  blocked(
    "braze_raw_query",
    "Run arbitrary requests",
    "Arbitrary endpoints, paths, pages, filters, time ranges, Campaigns outside the bounded list, pagination, crawling, synchronization, exports, and raw API access are outside V1.",
  ),
];

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
const campaignAnalyticsSchema = {
  type: "object",
  properties: {
    campaignId: {
      type: "string",
      minLength: 1,
      maxLength: 128,
      pattern: "^[A-Za-z0-9_-]+$",
    },
    endingAt: { type: "string", minLength: 20, maxLength: 64 },
  },
  required: ["campaignId", "endingAt"],
  additionalProperties: false,
};

export const BRAZE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "braze",
  name: "Braze",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.braze.com/docs/api/basics/",
  providerWebsiteUrl: "https://www.braze.com/",
  capabilities: [
    {
      ...capability(
        "campaign_metadata",
        "Campaign metadata",
        "List bounded, content-free Campaign lifecycle summaries.",
        true,
      ),
      platformCapability: "braze_campaign_read",
    },
    {
      ...capability(
        "canvas_metadata",
        "Canvas metadata",
        "List bounded, content-free Canvas lifecycle summaries.",
        true,
      ),
      platformCapability: "braze_canvas_read",
    },
    {
      ...capability(
        "campaign_analytics",
        "Campaign analytics",
        "Read one fixed seven-day Campaign aggregate series.",
        true,
      ),
      platformCapability: "braze_campaign_analytics_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BRAZE_REST_ENDPOINT",
        label: "Braze REST endpoint",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the exact regional REST endpoint shown with the key in Settings > APIs and Identifiers. Relay accepts only Braze's currently documented regional hosts.",
      },
      {
        name: "BRAZE_REST_API_KEY",
        label: "Braze REST API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: `Create a dedicated workspace key with exactly ${BRAZE_PERMISSIONS.join(", ")}; configure Railway egress IPs at creation because Braze key permissions and IP allowlists are immutable.`,
      },
    ],
  },
  tools: [
    {
      name: "braze.listRecentCampaigns",
      functionName: "braze_campaign_list_recent",
      aliases: ["braze.listRecentCampaigns", "braze_campaign_list_recent"],
      capability: "campaign_metadata",
      platformCapability: "braze_campaign_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page zero of up to twenty-five newest unarchived Campaign lifecycle summaries without names or tags.",
      inputSchema: emptySchema,
    },
    {
      name: "braze.listRecentCanvases",
      functionName: "braze_canvas_list_recent",
      aliases: ["braze.listRecentCanvases", "braze_canvas_list_recent"],
      capability: "canvas_metadata",
      platformCapability: "braze_canvas_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page zero of up to twenty-five newest unarchived Canvas lifecycle summaries without names or tags.",
      inputSchema: emptySchema,
    },
    {
      name: "braze.getCampaignAnalytics",
      functionName: "braze_campaign_analytics_get",
      aliases: ["braze.getCampaignAnalytics", "braze_campaign_analytics_get"],
      capability: "campaign_analytics",
      platformCapability: "braze_campaign_analytics_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read a fixed seven-day top-level aggregate series for one Campaign proven to belong to the bounded newest page.",
      inputSchema: campaignAnalyticsSchema,
    },
  ],
  approvalProfiles: [
    {
      id: "braze_safe",
      label: "Safe",
      description:
        "Three bounded metadata and aggregate reads run automatically; users, audiences, identity, content, detailed reports, broader APIs, arbitrary requests, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact regional endpoint and provider permissions, fixed pages and time windows, membership checks, audit, redaction, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "scoped_key",
      label:
        "Braze regional REST endpoint and campaigns.list plus canvas.list permission validation",
      requiredScopes: BRAZE_PERMISSIONS,
    },
  ],
};
