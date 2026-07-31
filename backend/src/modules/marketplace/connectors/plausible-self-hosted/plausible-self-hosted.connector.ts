import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "plausible_self_hosted_overview",
    "Read overview",
    "Read fixed aggregate visitor, visit, pageview and engagement metrics.",
  ),
  action(
    "plausible_self_hosted_top_pages",
    "Read top pages",
    "Read at most twenty page-path rows with bounded aggregate metrics and stripped query strings.",
  ),
  action(
    "plausible_self_hosted_sources",
    "Read sources",
    "Read at most twenty aggregate traffic-source rows.",
  ),
  action(
    "plausible_self_hosted_countries",
    "Read countries",
    "Read at most twenty country-level aggregate traffic rows.",
  ),
];
const blockedActions = [
  blocked(
    "plausible_self_hosted_events",
    "Send events",
    "Events API calls, pageviews, custom events, goals and historical event injection are unavailable.",
  ),
  blocked(
    "plausible_self_hosted_sites",
    "Manage sites",
    "Site provisioning, settings, goals, shared links, users, teams and API keys are unavailable.",
  ),
  blocked(
    "plausible_self_hosted_raw_data",
    "Read raw data",
    "ClickHouse, PostgreSQL, raw events, exports, User IDs, IP addresses and visitor-level records are unavailable.",
  ),
  blocked(
    "plausible_self_hosted_raw_query",
    "Run raw stats queries",
    "Agents cannot choose dimensions, metrics, filters, segments, date ranges, offsets, site IDs, URLs or arbitrary request bodies.",
  ),
  blocked(
    "plausible_self_hosted_private_network",
    "Reach private infrastructure",
    "Private, local, reserved, link-local, non-HTTPS and redirecting endpoints are unavailable; Relay opens no tunnel and keeps the web backend on Railway.",
  ),
  blocked(
    "plausible_self_hosted_unbounded_export",
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

export const PLAUSIBLE_SELF_HOSTED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "plausible-self-hosted",
    name: "Plausible Self-Hosted",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://plausible.io/docs/stats-api",
    providerWebsiteUrl: "https://github.com/plausible/analytics",
    capabilities: [
      {
        ...capability(
          "traffic_overview",
          "Traffic overview",
          "Read aggregate visitors, visits, pageviews and engagement metrics for one exact site.",
          true,
        ),
        platformCapability: "plausible_self_hosted_traffic_overview",
      },
      {
        ...capability(
          "content_sources",
          "Content and acquisition",
          "Read bounded page-path and traffic-source aggregate reports.",
          true,
        ),
        platformCapability: "plausible_self_hosted_content_sources",
      },
      {
        ...capability(
          "geography",
          "Aggregate geography",
          "Read bounded country-level aggregate traffic without visitor-level location records.",
          false,
        ),
        platformCapability: "plausible_self_hosted_geography",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "PLAUSIBLE_SELF_HOSTED_INSTALLATION_URL",
          label: "Plausible installation URL",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The public HTTPS root of one current Plausible Community Edition installation.",
        },
        {
          name: "PLAUSIBLE_SELF_HOSTED_API_KEY",
          label: "Plausible Stats API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "A dedicated Stats API key for the team that owns the intended site. Relay injects it only into fixed Authorization headers.",
        },
        {
          name: "PLAUSIBLE_SELF_HOSTED_SITE_ID",
          label: "Plausible site ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText: "The exact domain-style site_id configured in Plausible.",
        },
      ],
    },
    tools: [
      {
        name: "plausibleSelfHosted.overview",
        functionName: "plausible_self_hosted_overview",
        aliases: [
          "plausibleSelfHosted.overview",
          "plausible_self_hosted_overview",
        ],
        capability: "traffic_overview",
        platformCapability: "plausible_self_hosted_traffic_overview",
        action: "read",
        approvalRequired: true,
        description: "Read fixed aggregate visitor and engagement metrics.",
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
        name: "plausibleSelfHosted.topPages",
        functionName: "plausible_self_hosted_top_pages",
        aliases: [
          "plausibleSelfHosted.topPages",
          "plausible_self_hosted_top_pages",
        ],
        capability: "content_sources",
        platformCapability: "plausible_self_hosted_content_sources",
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
        name: "plausibleSelfHosted.sources",
        functionName: "plausible_self_hosted_sources",
        aliases: [
          "plausibleSelfHosted.sources",
          "plausible_self_hosted_sources",
        ],
        capability: "content_sources",
        platformCapability: "plausible_self_hosted_content_sources",
        action: "read",
        approvalRequired: true,
        description: "Read at most twenty aggregate traffic-source rows.",
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
        name: "plausibleSelfHosted.countries",
        functionName: "plausible_self_hosted_countries",
        aliases: [
          "plausibleSelfHosted.countries",
          "plausible_self_hosted_countries",
        ],
        capability: "geography",
        platformCapability: "plausible_self_hosted_geography",
        action: "read",
        approvalRequired: true,
        description:
          "Read at most twenty country-level aggregate traffic rows.",
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
    ],
    approvalProfiles: [
      {
        id: "plausible_self_hosted_safe",
        label: "Safe",
        description:
          "All private analytics reads require approval. Exact installation and site binding, fixed Stats API queries, bounds and audits always apply.",
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
        id: "plausible-site-overview",
        label: "Plausible Stats API key and exact site access",
      },
    ],
  };
