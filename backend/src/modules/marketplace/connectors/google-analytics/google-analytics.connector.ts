import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_ANALYTICS_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
];

const reads = [
  action(
    "google_analytics_property_get",
    "Get GA4 property",
    "Read safe metadata for the explicit connection-bound GA4 property.",
  ),
  action(
    "google_analytics_overview_report",
    "Get GA4 overview",
    "Run the fixed thirty-day aggregate channel overview for the explicit property.",
  ),
];

const blockedActions = [
  blocked(
    "google_analytics_property_discovery",
    "Discover Analytics properties",
    "Account, property, data-stream, and hierarchy discovery are blocked in V1.",
  ),
  blocked(
    "google_analytics_arbitrary_realtime_advanced_reports",
    "Run arbitrary or advanced Analytics reports",
    "Custom, realtime, batch, pivot, funnel, access, metadata, and compatibility reports are blocked.",
  ),
  blocked(
    "google_analytics_audience_user_detail",
    "Access audience or user-level Analytics data",
    "Audience exports and user, demographic, interest, page, search, geography, custom-dimension, and event-parameter detail are excluded.",
  ),
  blocked(
    "google_analytics_admin_mutation",
    "Mutate Analytics administration",
    "Property, stream, link, filter, event, dimension, metric, and settings mutations are blocked.",
  ),
  blocked(
    "google_analytics_user_management",
    "Manage Analytics users",
    "Account and property user-access bindings are excluded.",
  ),
  blocked(
    "google_analytics_measurement_protocol_write",
    "Write Analytics events",
    "Measurement Protocol and data-import writes are blocked.",
  ),
  blocked(
    "google_analytics_property_delete",
    "Delete Analytics resources",
    "Deleting, trashing, and restoring Analytics resources are blocked.",
  ),
  blocked(
    "google_analytics_export_all",
    "Export Analytics data",
    "Audience or report tasks, recurring exports, broad downloads, and automatic pagination are blocked.",
  ),
  blocked(
    "google_analytics_raw_delegation",
    "Use raw or delegated Analytics access",
    "Raw tools, service accounts, delegation, automatic retries, and polling are blocked.",
  ),
];

const propertyId = {
  type: "string",
  minLength: 1,
  maxLength: 32,
  pattern: "^[0-9]+$",
};

export const GOOGLE_ANALYTICS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "google-analytics",
    name: "Google Analytics",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developers.google.com/analytics",
    providerWebsiteUrl: "https://analytics.google.com/",
    capabilities: [
      {
        ...capability(
          "property_get",
          "Read GA4 property metadata",
          "Read bounded safe metadata for the one GA4 property bound during OAuth.",
          true,
        ),
        platformCapability: "google_analytics_property_get",
      },
      {
        ...capability(
          "overview_report",
          "Read aggregate GA4 overview",
          "Read at most twenty-five channel-group rows from one fixed thirty-day aggregate report.",
          true,
        ),
        platformCapability: "google_analytics_overview_report",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        refreshUrl: "https://oauth2.googleapis.com/token",
        revocationUrl: "https://oauth2.googleapis.com/revoke",
        requiredScopes: GOOGLE_ANALYTICS_SCOPES,
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
        name: "googleAnalytics.getProperty",
        functionName: "google_analytics_property_get",
        aliases: ["google_analytics_property_get"],
        capability: "property_get",
        platformCapability: "google_analytics_property_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded metadata for the exact GA4 property bound during OAuth setup.",
        inputSchema: {
          type: "object",
          properties: { propertyId },
          required: ["propertyId"],
          additionalProperties: false,
        },
      },
      {
        name: "googleAnalytics.getOverview",
        functionName: "google_analytics_overview_report",
        aliases: ["google_analytics_overview_report"],
        capability: "overview_report",
        platformCapability: "google_analytics_overview_report",
        action: "read",
        approvalRequired: false,
        description:
          "Run Relay's fixed thirty-day channel overview and return at most twenty-five aggregate rows.",
        inputSchema: {
          type: "object",
          properties: { propertyId },
          required: ["propertyId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "google_analytics_safe",
        label: "Safe",
        description:
          "Only one explicit-property metadata read and one fixed aggregate overview run automatically; discovery, granular detail, advanced reports, exports, administration, and writes remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Both selected read-only wrappers run automatically while exact scope, bound property, fixed report, aggregate fields, row limit, redaction, and no-pagination boundaries remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "explicit-property-fixed-report",
        label:
          "Exact read-only scope, bound GA4 property, and fixed aggregate report boundary",
        requiredScopes: GOOGLE_ANALYTICS_SCOPES,
      },
    ],
  };
