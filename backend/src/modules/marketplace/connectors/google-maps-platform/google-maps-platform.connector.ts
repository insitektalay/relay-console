import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "google_maps_platform_geocode_address",
    "Geocode address",
    "Resolve one explicit address to up to five bounded location matches.",
  ),
  action(
    "google_maps_platform_reverse_geocode",
    "Reverse geocode coordinates",
    "Resolve one explicit coordinate pair to up to five bounded address matches.",
  ),
  action(
    "google_maps_platform_search_places",
    "Search places",
    "Run one bounded text search and return up to ten basic place matches.",
  ),
  action(
    "google_maps_platform_compute_route",
    "Compute route summary",
    "Compute one route summary between two explicit coordinate pairs without a polyline or steps.",
  ),
];
const blockedActions = [
  blocked(
    "google_maps_platform_raw_maps",
    "Use raw Maps APIs",
    "Raw endpoints, arbitrary fields, browser SDKs, tiles, Static Maps, Street View, and embedded maps are blocked.",
  ),
  blocked(
    "google_maps_platform_place_private_content",
    "Access expanded place content",
    "Place details, photos, reviews, phone numbers, websites, opening hours, autocomplete, and user content are blocked.",
  ),
  blocked(
    "google_maps_platform_tracking_navigation",
    "Track or navigate",
    "Tracking, geofencing, route matrices, turn-by-turn navigation, traffic-aware monitoring, and location histories are blocked.",
  ),
  blocked(
    "google_maps_platform_bulk_persist",
    "Bulk or persist Maps data",
    "Batch geocoding, exports, caching, storage, automatic pagination, polling, and automatic retries are blocked.",
  ),
  blocked(
    "google_maps_platform_mutation_admin",
    "Mutate or administer Maps",
    "Edits, uploads, account administration, billing operations, key management, and project administration are blocked.",
  ),
];
const coordinate = {
  type: "object",
  properties: {
    latitude: { type: "number", minimum: -90, maximum: 90 },
    longitude: { type: "number", minimum: -180, maximum: 180 },
  },
  required: ["latitude", "longitude"],
  additionalProperties: false,
};

export const GOOGLE_MAPS_PLATFORM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "google-maps-platform",
    name: "Google Maps Platform",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developers.google.com/maps/documentation",
    providerWebsiteUrl: "https://mapsplatform.google.com/",
    capabilities: [
      {
        ...capability(
          "geocode",
          "Geocode address",
          "Resolve one address to bounded location matches.",
          true,
        ),
        platformCapability: "google_maps_platform_geocode_address",
      },
      {
        ...capability(
          "reverse_geocode",
          "Reverse geocode",
          "Resolve coordinates to bounded address matches.",
          true,
        ),
        platformCapability: "google_maps_platform_reverse_geocode",
      },
      {
        ...capability(
          "place_search",
          "Search places",
          "Find up to ten places with basic display and location fields.",
          true,
        ),
        platformCapability: "google_maps_platform_search_places",
      },
      {
        ...capability(
          "route_summary",
          "Compute route summary",
          "Read one distance and duration summary without route geometry.",
          true,
        ),
        platformCapability: "google_maps_platform_compute_route",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "GOOGLE_MAPS_PLATFORM_API_KEY",
          label: "Google Maps Platform API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Customer-owned billed-project API key stored encrypted by Railway and restricted to Relay server egress plus the Geocoding, Places, and Routes APIs.",
        },
      ],
    },
    tools: [
      {
        name: "googleMapsPlatform.geocodeAddress",
        functionName: "google_maps_platform_geocode_address",
        aliases: ["google_maps_platform_geocode_address"],
        capability: "geocode",
        platformCapability: "google_maps_platform_geocode_address",
        action: "read",
        approvalRequired: false,
        description:
          "Resolve one explicit address to at most five bounded geocoding matches.",
        inputSchema: {
          type: "object",
          properties: {
            address: { type: "string", minLength: 1, maxLength: 500 },
          },
          required: ["address"],
          additionalProperties: false,
        },
      },
      {
        name: "googleMapsPlatform.reverseGeocode",
        functionName: "google_maps_platform_reverse_geocode",
        aliases: ["google_maps_platform_reverse_geocode"],
        capability: "reverse_geocode",
        platformCapability: "google_maps_platform_reverse_geocode",
        action: "read",
        approvalRequired: false,
        description:
          "Resolve one explicit coordinate pair to at most five bounded address matches.",
        inputSchema: {
          type: "object",
          properties: coordinate.properties,
          required: coordinate.required,
          additionalProperties: false,
        },
      },
      {
        name: "googleMapsPlatform.searchPlaces",
        functionName: "google_maps_platform_search_places",
        aliases: ["google_maps_platform_search_places"],
        capability: "place_search",
        platformCapability: "google_maps_platform_search_places",
        action: "read",
        approvalRequired: false,
        description:
          "Run one text query and return at most ten places with fixed basic fields.",
        inputSchema: {
          type: "object",
          properties: {
            textQuery: { type: "string", minLength: 1, maxLength: 256 },
          },
          required: ["textQuery"],
          additionalProperties: false,
        },
      },
      {
        name: "googleMapsPlatform.computeRoute",
        functionName: "google_maps_platform_compute_route",
        aliases: ["google_maps_platform_compute_route"],
        capability: "route_summary",
        platformCapability: "google_maps_platform_compute_route",
        action: "read",
        approvalRequired: false,
        description:
          "Compute one route distance and duration without geometry, steps, alternatives, or traffic monitoring.",
        inputSchema: {
          type: "object",
          properties: {
            origin: coordinate,
            destination: coordinate,
            travelMode: {
              type: "string",
              enum: ["DRIVE", "WALK", "BICYCLE", "TRANSIT"],
              default: "DRIVE",
            },
          },
          required: ["origin", "destination"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "google_maps_platform_bounded_reads",
        label: "Bounded reads",
        description:
          "Four single-request location reads run automatically; expanded place content, tracking, raw Maps access, bulk use, persistence, and mutations remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The fixed hosts, paths, fields, result caps, no-persistence rule, and single-request read-only boundaries remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "restricted-api-key",
        label: "Encrypted IP- and API-restricted server key",
      },
    ],
  };
