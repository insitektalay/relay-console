import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "umami_self_hosted_stats",
    "Read website statistics",
    "Read fixed aggregate pageview, visitor, visit, bounce and time totals.",
  ),
  action(
    "umami_self_hosted_top_pages",
    "Read top pages",
    "Read at most twenty aggregate page-path rows with query strings stripped.",
  ),
  action(
    "umami_self_hosted_pageviews",
    "Read pageview series",
    "Read a bounded UTC pageview and session time series for one recent window.",
  ),
  action(
    "umami_self_hosted_active_visitors",
    "Read active visitors",
    "Read the aggregate number of visitors active in the last five minutes.",
  ),
];
const blockedActions = [
  blocked(
    "umami_self_hosted_events",
    "Send events",
    "Tracking, identify, performance, custom-event and historical event injection calls are unavailable.",
  ),
  blocked(
    "umami_self_hosted_sites",
    "Manage sites",
    "Website provisioning, settings, reset, shared links, users, teams and account administration are unavailable.",
  ),
  blocked(
    "umami_self_hosted_raw_data",
    "Read raw data",
    "PostgreSQL, raw events, sessions, event data, distinct IDs and visitor-level records are unavailable.",
  ),
  blocked(
    "umami_self_hosted_raw_query",
    "Run raw stats queries",
    "Agents cannot choose metric types, filters, segments, timestamps, timezones, offsets, website IDs, URLs or arbitrary requests.",
  ),
  blocked(
    "umami_self_hosted_private_network",
    "Reach private infrastructure",
    "Private, local, reserved, link-local, non-HTTPS and redirecting endpoints are unavailable; Relay opens no tunnel and keeps the web backend on Railway.",
  ),
  blocked(
    "umami_self_hosted_unbounded_export",
    "Export unbounded analytics",
    "Five fixed recent windows, twenty-row tables and 256 KiB responses are the maximum supported surface.",
  ),
];
const windowProperty = {
  type: "string",
  enum: ["day", "24h", "7d", "28d", "month"],
  default: "7d",
};
const limitProperty = { type: "integer", minimum: 1, maximum: 20, default: 10 };

export const UMAMI_SELF_HOSTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "umami-self-hosted",
    name: "Umami Self-Hosted",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://docs.umami.is/docs/api/website-stats",
    providerWebsiteUrl: "https://github.com/umami-software/umami",
    capabilities: [
      {
        ...capability(
          "traffic_overview",
          "Traffic overview",
          "Read aggregate website totals and a bounded pageview/session time series for one exact website.",
          true,
        ),
        platformCapability: "umami_self_hosted_traffic_overview",
      },
      {
        ...capability(
          "content_performance",
          "Content performance",
          "Read bounded aggregate top-page paths with query strings removed.",
          true,
        ),
        platformCapability: "umami_self_hosted_content_performance",
      },
      {
        ...capability(
          "realtime_aggregate",
          "Aggregate active visitors",
          "Read only the current aggregate active-visitor count.",
          false,
        ),
        platformCapability: "umami_self_hosted_realtime_aggregate",
      },
    ],
    auth: {
      type: "custom",
      credentialSchema: [
        {
          name: "UMAMI_SELF_HOSTED_INSTALLATION_URL",
          label: "Umami installation URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["custom"],
          helpText:
            "The public HTTPS root of one current customer-operated Umami installation.",
        },
        {
          name: "UMAMI_SELF_HOSTED_USERNAME",
          label: "Umami username",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["custom"],
          helpText:
            "A dedicated least-privilege Umami user that can view only the intended website.",
        },
        {
          name: "UMAMI_SELF_HOSTED_PASSWORD",
          label: "Umami password",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["custom"],
          helpText:
            "The dedicated user's password. Relay sends it only to the exact installation's fixed login endpoint and never logs it or the returned bearer token.",
        },
        {
          name: "UMAMI_SELF_HOSTED_WEBSITE_ID",
          label: "Umami website ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["custom"],
          helpText: "The exact UUID of the intended Umami website.",
        },
      ],
    },
    tools: [
      {
        name: "umamiSelfHosted.stats",
        functionName: "umami_self_hosted_stats",
        aliases: ["umamiSelfHosted.stats", "umami_self_hosted_stats"],
        capability: "traffic_overview",
        platformCapability: "umami_self_hosted_traffic_overview",
        action: "read",
        approvalRequired: true,
        description: "Read fixed aggregate website statistics.",
        inputSchema: {
          type: "object",
          properties: {
            window: windowProperty,
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "umamiSelfHosted.topPages",
        functionName: "umami_self_hosted_top_pages",
        aliases: ["umamiSelfHosted.topPages", "umami_self_hosted_top_pages"],
        capability: "content_performance",
        platformCapability: "umami_self_hosted_content_performance",
        action: "read",
        approvalRequired: true,
        description:
          "Read at most twenty top page paths with aggregate metrics.",
        inputSchema: {
          type: "object",
          properties: {
            window: windowProperty,
            limit: limitProperty,
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "umamiSelfHosted.pageviews",
        functionName: "umami_self_hosted_pageviews",
        aliases: ["umamiSelfHosted.pageviews", "umami_self_hosted_pageviews"],
        capability: "traffic_overview",
        platformCapability: "umami_self_hosted_traffic_overview",
        action: "read",
        approvalRequired: true,
        description: "Read a bounded UTC pageview and session time series.",
        inputSchema: {
          type: "object",
          properties: {
            window: windowProperty,
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "umamiSelfHosted.activeVisitors",
        functionName: "umami_self_hosted_active_visitors",
        aliases: [
          "umamiSelfHosted.activeVisitors",
          "umami_self_hosted_active_visitors",
        ],
        capability: "realtime_aggregate",
        platformCapability: "umami_self_hosted_realtime_aggregate",
        action: "read",
        approvalRequired: true,
        description: "Read the aggregate active-visitor count.",
        inputSchema: {
          type: "object",
          properties: {
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "umami_self_hosted_safe",
        label: "Safe",
        description:
          "All private analytics reads require approval. Exact installation and website binding, fixed API queries, bounds and audits always apply.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: reads,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All four aggregate reads run without Relay per-action approval; exact authority, fixed queries, bounds, redaction and audits still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "umami-website-stats",
        label: "Umami login and exact website access",
      },
    ],
  };
