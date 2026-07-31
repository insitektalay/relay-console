import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "fred_series_search",
    "Search FRED series",
    "Search for at most ten public economic-data series through one fixed FRED endpoint.",
  ),
  action(
    "fred_series_observations_get",
    "Read recent FRED observations",
    "Read at most 25 newest observations for one validated series identifier through one fixed FRED endpoint.",
  ),
];
const blocks = [
  blocked(
    "fred_bulk_vintage_transforms",
    "Block bulk, vintage, and transformed data",
    "Bulk downloads, pagination, offsets, ALFRED/vintage dates, output formats, units transformations, frequency aggregation, and unbounded observation history are unavailable.",
  ),
  blocked(
    "fred_categories_releases_sources_tags",
    "Block broader metadata surfaces",
    "Categories, releases, release dates, sources, tags, maps, related tags, series updates, and arbitrary discovery surfaces are unavailable.",
  ),
  blocked(
    "fred_credentials_raw_mutations",
    "Block credential and raw access",
    "API-key administration, arbitrary hosts, paths, query parameters, redirects, retries, writes, deletes, uploads, webhooks, and raw APIs are unavailable.",
  ),
];

export const FRED_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "fred",
  name: "FRED",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://fred.stlouisfed.org/docs/api/fred/",
  providerWebsiteUrl: "https://fred.stlouisfed.org/",
  capabilities: [
    {
      ...capability(
        "series_search",
        "Search economic series",
        "Search for at most ten public FRED series with bounded metadata.",
        true,
      ),
      platformCapability: "series_search",
    },
    {
      ...capability(
        "series_observations_read",
        "Read recent observations",
        "Read at most 25 newest observations for one validated FRED series.",
        true,
      ),
      platformCapability: "series_observations_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FRED_API_KEY",
        label: "Customer-owned FRED API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use your own 32-character lowercase FRED API key. Relay encrypts its copy; replace or revoke it from your FRED account after disconnect.",
      },
    ],
  },
  tools: [
    {
      name: "relay_fred_search_series",
      functionName: "relay_fred_search_series",
      aliases: ["fred_series_search"],
      capability: "series_search",
      platformCapability: "series_search",
      action: "read",
      approvalRequired: false,
      description:
        "Search for at most ten public FRED economic-data series by a short text query.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 2, maxLength: 80 } },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_fred_get_series_observations",
      functionName: "relay_fred_get_series_observations",
      aliases: ["fred_series_observations_get"],
      capability: "series_observations_read",
      platformCapability: "series_observations_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most 25 newest date/value observations for one validated FRED series identifier.",
      inputSchema: {
        type: "object",
        properties: {
          seriesId: {
            type: "string",
            minLength: 1,
            maxLength: 64,
            pattern: "^[A-Za-z0-9._-]+$",
          },
          limit: { type: "integer", minimum: 1, maximum: 25, default: 10 },
        },
        required: ["seriesId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "fred_safe",
      label: "Safe",
      description:
        "Two fixed, bounded public economic-data reads run automatically; bulk, vintage, transformed, broader metadata, credential administration, and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same two fixed reads run without Relay per-action approval; query and result bounds, exact routes, response reduction, audits, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "customer_api_key", label: "Customer-owned FRED API key" },
  ],
};
