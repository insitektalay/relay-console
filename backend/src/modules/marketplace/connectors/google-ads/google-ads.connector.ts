import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_ADS_SCOPES = ["https://www.googleapis.com/auth/adwords"];

const reads = [
  action(
    "google_ads_customer_summary_get",
    "Get Google Ads customer summary",
    "Read bounded metadata for one explicit advertiser or manager customer.",
  ),
  action(
    "google_ads_campaign_performance_report",
    "Get Google Ads campaign performance",
    "Read up to fifty campaigns over the last thirty days through Relay's fixed reporting query.",
  ),
];

const blockedActions = [
  blocked(
    "google_ads_account_discovery",
    "Discover Google Ads accounts",
    "Accessible-customer listing and manager hierarchy traversal are blocked in V1.",
  ),
  blocked(
    "google_ads_arbitrary_query_stream_export",
    "Run arbitrary or bulk Google Ads reports",
    "Raw GAQL, SearchStream, pagination, export, and scheduled reporting are blocked.",
  ),
  blocked(
    "google_ads_campaign_mutations",
    "Mutate Google Ads campaigns",
    "Creating, updating, pausing, enabling, or removing campaigns is blocked.",
  ),
  blocked(
    "google_ads_budget_bidding_mutations",
    "Change Google Ads budgets or bids",
    "Financial controls, budgets, bids, and bidding strategies are blocked.",
  ),
  blocked(
    "google_ads_ads_keywords_assets_mutations",
    "Mutate ads, keywords, or assets",
    "Advertising-object mutation is outside reporting-only V1.",
  ),
  blocked(
    "google_ads_planning_recommendations",
    "Use planning or recommendations",
    "Planning, keyword research, and recommendation mutation are blocked.",
  ),
  blocked(
    "google_ads_audiences_customer_match",
    "Access audiences or Customer Match",
    "Audience, user-list, and Customer Match data are excluded.",
  ),
  blocked(
    "google_ads_search_terms_click_data",
    "Access search terms or click data",
    "Search terms, click views, GCLIDs, IP addresses, and granular user or location data are excluded.",
  ),
  blocked(
    "google_ads_offline_conversions",
    "Use offline conversions",
    "Offline conversion and customer-data uploads or adjustments are blocked.",
  ),
  blocked(
    "google_ads_billing_users_links",
    "Access billing, users, or account links",
    "Billing, invoices, payments, users, manager links, and linked-customer data are excluded.",
  ),
  blocked(
    "google_ads_raw_service_account_delegation",
    "Use raw or delegated Google Ads access",
    "Raw services, service accounts, automatic retries, automatic pagination, and delegation are blocked.",
  ),
];

const customerId = {
  type: "string",
  minLength: 10,
  maxLength: 10,
  pattern: "^[0-9]{10}$",
};

export const GOOGLE_ADS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-ads",
  name: "Google Ads",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.google.com/google-ads/api/docs/start",
  providerWebsiteUrl: "https://ads.google.com/",
  capabilities: [
    {
      ...capability(
        "customer_summary",
        "Read customer summary",
        "Read bounded non-user metadata for one explicit Google Ads customer.",
        true,
      ),
      platformCapability: "google_ads_customer_summary",
    },
    {
      ...capability(
        "campaign_performance",
        "Read campaign performance",
        "Compare up to fifty campaigns over the fixed last-thirty-days reporting window.",
        true,
      ),
      platformCapability: "google_ads_campaign_performance",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_ADS_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GOOGLE_OAUTH_CLIENT_ID",
        label: "Google OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console confidential web OAuth client ID.",
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Google OAuth client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "googleAds.getCustomerSummary",
      functionName: "google_ads_customer_summary_get",
      aliases: ["google_ads_customer_summary_get"],
      capability: "customer_summary",
      platformCapability: "google_ads_customer_summary",
      action: "read",
      approvalRequired: false,
      description:
        "Run Relay's fixed one-row customer summary query for one explicit ten-digit customer ID.",
      inputSchema: {
        type: "object",
        properties: { customerId },
        required: ["customerId"],
        additionalProperties: false,
      },
    },
    {
      name: "googleAds.getCampaignPerformance",
      functionName: "google_ads_campaign_performance_report",
      aliases: ["google_ads_campaign_performance_report"],
      capability: "campaign_performance",
      platformCapability: "google_ads_campaign_performance",
      action: "read",
      approvalRequired: false,
      description:
        "Run Relay's fixed last-thirty-days query and return at most fifty campaign rows without pagination.",
      inputSchema: {
        type: "object",
        properties: { customerId },
        required: ["customerId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "google_ads_safe",
      label: "Safe",
      description:
        "Only two fixed, bounded, reporting-only reads run automatically; all discovery, raw, sensitive-data, financial, administrative, and mutation surfaces remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both selected read-only wrappers run automatically while the exact scope, explicit-customer, fixed-query, response, privacy, and reporting-only boundaries remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "reporting-only-explicit-customer",
      label:
        "Google OAuth, Relay developer token, and fixed reporting-only query boundary",
      requiredScopes: GOOGLE_ADS_SCOPES,
    },
  ],
};
