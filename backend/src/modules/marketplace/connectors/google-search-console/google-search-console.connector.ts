import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_SEARCH_CONSOLE_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
];

const reads = [
  action(
    "google_search_console_properties_list",
    "List Search Console properties",
    "List at most twenty-five accessible Search Console properties.",
  ),
  action(
    "google_search_console_property_get",
    "Get Search Console property",
    "Confirm access to the connection-bound Search Console property.",
  ),
  action(
    "google_search_console_search_analytics_query",
    "Query Search Analytics",
    "Run one bounded Search Analytics query for the connection-bound property.",
  ),
  action(
    "google_search_console_url_inspect",
    "Inspect indexed URL",
    "Read the indexed status of one URL under the connection-bound property.",
  ),
  action(
    "google_search_console_sitemaps_list",
    "List sitemaps",
    "List at most twenty-five sitemaps for the connection-bound property.",
  ),
  action(
    "google_search_console_sitemap_get",
    "Get sitemap",
    "Read one sitemap status record for the connection-bound property.",
  ),
];

const blockedActions = [
  blocked(
    "google_search_console_sitemap_submit",
    "Submit sitemap",
    "Sitemap submission is a write and is blocked.",
  ),
  blocked(
    "google_search_console_sitemap_delete",
    "Delete sitemap",
    "Sitemap deletion is blocked.",
  ),
  blocked(
    "google_search_console_site_add",
    "Add property",
    "Search Console property administration is blocked.",
  ),
  blocked(
    "google_search_console_site_delete",
    "Delete property",
    "Search Console property administration is blocked.",
  ),
  blocked(
    "google_search_console_broad_export",
    "Export Search Console data",
    "Broad exports, automatic pagination, and raw API access are blocked.",
  ),
];

const siteUrl = { type: "string", minLength: 1, maxLength: 2048 };
const maxResults = { type: "integer", minimum: 1, maximum: 25, default: 25 };

export const GOOGLE_SEARCH_CONSOLE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "google-search-console",
    name: "Google Search Console",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developers.google.com/webmaster-tools",
    providerWebsiteUrl: "https://search.google.com/search-console",
    capabilities: [
      {
        ...capability(
          "properties_list",
          "List properties",
          "List a bounded set of accessible properties.",
          true,
        ),
        platformCapability: "google_search_console_properties_list",
      },
      {
        ...capability(
          "property_get",
          "Read property",
          "Confirm access to the selected property.",
          true,
        ),
        platformCapability: "google_search_console_property_get",
      },
      {
        ...capability(
          "search_analytics_query",
          "Query Search Analytics",
          "Read a bounded 28-day Search Analytics slice.",
          true,
        ),
        platformCapability: "google_search_console_search_analytics_query",
      },
      {
        ...capability(
          "url_inspect",
          "Inspect indexed URL",
          "Read safe indexed URL status.",
          true,
        ),
        platformCapability: "google_search_console_url_inspect",
      },
      {
        ...capability(
          "sitemaps_list",
          "List sitemaps",
          "List bounded sitemap status records.",
          true,
        ),
        platformCapability: "google_search_console_sitemaps_list",
      },
      {
        ...capability(
          "sitemap_get",
          "Read sitemap",
          "Read one sitemap status record.",
          true,
        ),
        platformCapability: "google_search_console_sitemap_get",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        refreshUrl: "https://oauth2.googleapis.com/token",
        revocationUrl: "https://oauth2.googleapis.com/revoke",
        requiredScopes: GOOGLE_SEARCH_CONSOLE_SCOPES,
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
        name: "googleSearchConsole.listProperties",
        functionName: "google_search_console_properties_list",
        aliases: ["google_search_console_properties_list"],
        capability: "properties_list",
        platformCapability: "google_search_console_properties_list",
        action: "read",
        approvalRequired: false,
        description:
          "List at most twenty-five accessible Search Console properties without pagination.",
        inputSchema: {
          type: "object",
          properties: { maxResults },
          additionalProperties: false,
        },
      },
      {
        name: "googleSearchConsole.getProperty",
        functionName: "google_search_console_property_get",
        aliases: ["google_search_console_property_get"],
        capability: "property_get",
        platformCapability: "google_search_console_property_get",
        action: "read",
        approvalRequired: false,
        description: "Confirm access to the selected Search Console property.",
        inputSchema: {
          type: "object",
          properties: { siteUrl },
          additionalProperties: false,
        },
      },
      {
        name: "googleSearchConsole.querySearchAnalytics",
        functionName: "google_search_console_search_analytics_query",
        aliases: ["google_search_console_search_analytics_query"],
        capability: "search_analytics_query",
        platformCapability: "google_search_console_search_analytics_query",
        action: "read",
        approvalRequired: false,
        description:
          "Run one bounded Search Analytics query over at most twenty-eight days and twenty-five rows.",
        inputSchema: {
          type: "object",
          properties: {
            siteUrl,
            startDate: {
              type: "string",
              pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
            },
            endDate: {
              type: "string",
              pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
            },
            dimensions: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              uniqueItems: true,
              items: {
                type: "string",
                enum: [
                  "query",
                  "page",
                  "date",
                  "country",
                  "device",
                  "searchAppearance",
                ],
              },
            },
            searchType: {
              type: "string",
              enum: ["web", "image", "video", "news", "discover", "googleNews"],
              default: "web",
            },
            aggregationType: {
              type: "string",
              enum: ["auto", "byPage", "byProperty"],
              default: "auto",
            },
            rowLimit: { type: "integer", minimum: 1, maximum: 25, default: 10 },
          },
          required: ["startDate", "endDate"],
          additionalProperties: false,
        },
      },
      {
        name: "googleSearchConsole.inspectUrl",
        functionName: "google_search_console_url_inspect",
        aliases: ["google_search_console_url_inspect"],
        capability: "url_inspect",
        platformCapability: "google_search_console_url_inspect",
        action: "read",
        approvalRequired: false,
        description:
          "Read indexed status for one URL contained by the selected property.",
        inputSchema: {
          type: "object",
          properties: {
            siteUrl,
            inspectionUrl: { type: "string", minLength: 1, maxLength: 2048 },
            languageCode: {
              type: "string",
              minLength: 2,
              maxLength: 35,
              pattern: "^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$",
            },
          },
          required: ["inspectionUrl"],
          additionalProperties: false,
        },
      },
      {
        name: "googleSearchConsole.listSitemaps",
        functionName: "google_search_console_sitemaps_list",
        aliases: ["google_search_console_sitemaps_list"],
        capability: "sitemaps_list",
        platformCapability: "google_search_console_sitemaps_list",
        action: "read",
        approvalRequired: false,
        description:
          "List at most twenty-five sitemaps for the selected property.",
        inputSchema: {
          type: "object",
          properties: { siteUrl, maxResults },
          additionalProperties: false,
        },
      },
      {
        name: "googleSearchConsole.getSitemap",
        functionName: "google_search_console_sitemap_get",
        aliases: ["google_search_console_sitemap_get"],
        capability: "sitemap_get",
        platformCapability: "google_search_console_sitemap_get",
        action: "read",
        approvalRequired: false,
        description:
          "Read one sitemap status record under the selected property.",
        inputSchema: {
          type: "object",
          properties: {
            siteUrl,
            feedpath: { type: "string", minLength: 1, maxLength: 2048 },
          },
          required: ["feedpath"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "google_search_console_safe",
        label: "Safe",
        description:
          "Six bounded read-only wrappers run automatically; administration, writes, broad exports, raw tools, and pagination remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same exact scope, selected-property, response, and no-pagination boundaries remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "readonly-selected-property",
        label: "Exact read-only scope and selected Search Console property",
        requiredScopes: GOOGLE_SEARCH_CONSOLE_SCOPES,
      },
    ],
  };
