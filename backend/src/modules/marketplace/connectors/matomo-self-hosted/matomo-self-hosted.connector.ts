import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "matomo_self_hosted_summary",
    "Read visit summary",
    "Read bounded aggregate visit and engagement metrics for one fixed recent window.",
  ),
  action(
    "matomo_self_hosted_top_pages",
    "Read top pages",
    "Read at most twenty page-path rows with bounded aggregate metrics and stripped query strings.",
  ),
  action(
    "matomo_self_hosted_referrer_types",
    "Read referrer types",
    "Read at most twenty aggregate traffic-source type rows.",
  ),
  action(
    "matomo_self_hosted_countries",
    "Read countries",
    "Read at most twenty country-level aggregate traffic rows.",
  ),
];

const blockedActions = [
  blocked(
    "matomo_self_hosted_tracking",
    "Track visits or events",
    "Tracking API calls, synthetic visits, ecommerce events and historical data injection are unavailable.",
  ),
  blocked(
    "matomo_self_hosted_visitor_data",
    "Read visitor-level data",
    "Visits logs, visitor profiles, User IDs, IP addresses, device fingerprints, session recordings, heatmaps and raw event exports are unavailable.",
  ),
  blocked(
    "matomo_self_hosted_management",
    "Administer Matomo",
    "Sites, users, roles, tokens, goals, funnels, segments, dashboards, reports, plugins, configuration, archiving and database management are unavailable.",
  ),
  blocked(
    "matomo_self_hosted_raw_api",
    "Call raw APIs",
    "Agents cannot choose API modules, methods, segments, dates, site IDs, URLs, formats, filters or arbitrary request parameters.",
  ),
  blocked(
    "matomo_self_hosted_private_network",
    "Reach private infrastructure",
    "Private, local, reserved, link-local, non-HTTPS and redirecting installation endpoints are unavailable; Relay never opens a tunnel or changes the web backend target.",
  ),
  blocked(
    "matomo_self_hosted_unbounded_export",
    "Export unbounded analytics",
    "Reports use four fixed recent windows, tables are capped at twenty rows, and responses are capped at 256 KiB.",
  ),
];

const windowProperty = {
  type: "string",
  enum: ["today", "yesterday", "this_week", "this_month"],
  default: "today",
};

export const MATOMO_SELF_HOSTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "matomo-self-hosted",
    name: "Matomo Self-Hosted",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developer.matomo.org/api-reference/reporting-api",
    providerWebsiteUrl: "https://matomo.org/matomo-on-premise/",
    capabilities: [
      {
        ...capability(
          "traffic_overview",
          "Traffic overview",
          "Read aggregate visit, engagement and traffic-source summaries for one exact site.",
          true,
        ),
        platformCapability: "matomo_self_hosted_traffic_overview",
      },
      {
        ...capability(
          "content_performance",
          "Content performance",
          "Read at most twenty page paths with aggregate performance metrics and query strings removed.",
          true,
        ),
        platformCapability: "matomo_self_hosted_content_performance",
      },
      {
        ...capability(
          "geography",
          "Aggregate geography",
          "Read at most twenty country-level aggregate traffic rows without visitor-level location data.",
          false,
        ),
        platformCapability: "matomo_self_hosted_geography",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "MATOMO_SELF_HOSTED_INSTALLATION_URL",
          label: "Matomo installation URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The public HTTPS root of one customer-operated Matomo installation. Private addresses, custom ports, redirects and embedded credentials are rejected.",
        },
        {
          name: "MATOMO_SELF_HOSTED_TOKEN_AUTH",
          label: "Matomo auth token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Use a dedicated POST-only token for a Matomo user with view permission only on the intended site. Relay sends it only in POST bodies.",
        },
        {
          name: "MATOMO_SELF_HOSTED_SITE_ID",
          label: "Matomo site ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "One exact positive numeric idSite that the dedicated token may view.",
        },
      ],
    },
    tools: [
      {
        name: "matomoSelfHosted.summary",
        functionName: "matomo_self_hosted_summary",
        aliases: ["matomoSelfHosted.summary", "matomo_self_hosted_summary"],
        capability: "traffic_overview",
        platformCapability: "matomo_self_hosted_traffic_overview",
        action: "read",
        approvalRequired: true,
        description:
          "Read bounded aggregate visit and engagement metrics for one fixed recent window.",
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
        name: "matomoSelfHosted.topPages",
        functionName: "matomo_self_hosted_top_pages",
        aliases: ["matomoSelfHosted.topPages", "matomo_self_hosted_top_pages"],
        capability: "content_performance",
        platformCapability: "matomo_self_hosted_content_performance",
        action: "read",
        approvalRequired: true,
        description:
          "Read at most twenty top page paths with aggregate metrics and query strings removed.",
        inputSchema: {
          type: "object",
          properties: {
            window: windowProperty,
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "matomoSelfHosted.referrerTypes",
        functionName: "matomo_self_hosted_referrer_types",
        aliases: [
          "matomoSelfHosted.referrerTypes",
          "matomo_self_hosted_referrer_types",
        ],
        capability: "traffic_overview",
        platformCapability: "matomo_self_hosted_traffic_overview",
        action: "read",
        approvalRequired: true,
        description: "Read at most twenty aggregate referrer-type rows.",
        inputSchema: {
          type: "object",
          properties: {
            window: windowProperty,
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "matomoSelfHosted.countries",
        functionName: "matomo_self_hosted_countries",
        aliases: ["matomoSelfHosted.countries", "matomo_self_hosted_countries"],
        capability: "geography",
        platformCapability: "matomo_self_hosted_geography",
        action: "read",
        approvalRequired: true,
        description:
          "Read at most twenty country-level aggregate traffic rows.",
        inputSchema: {
          type: "object",
          properties: {
            window: windowProperty,
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "matomo_self_hosted_safe",
        label: "Safe",
        description:
          "All private analytics reads require approval. Exact public installation and site binding, fixed POST-only methods, row/response bounds and audits always apply.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: reads,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All four selected aggregate reads run without Relay per-action approval; exact installation and site binding, fixed POST-only methods, bounds, redaction and audits still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "matomo-site-summary",
        label: "Matomo token and exact site access",
      },
    ],
  };
