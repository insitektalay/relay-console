import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ZOOM_ROOMS_REQUIRED_SCOPE = "zoom_rooms:read:list_rooms:admin";
const reads = [
  action(
    "zoom_rooms_fleet_list",
    "List room fleet health",
    "List one bounded page of anonymous Zoom Rooms status and type metadata.",
  ),
];
const blockedActions = [
  blocked(
    "zoom_rooms_private_identity",
    "Block room identity",
    "Room names, activation codes, room/location/user/calendar IDs, tag IDs, device IDs, IP addresses, serials, MAC addresses, and raw records are not returned.",
  ),
  blocked(
    "zoom_rooms_controls",
    "Block room controls",
    "Meeting start, join, invite, leave, end, mute, unmute, restart, shutdown, signage, alerts, and other room controls are not exposed.",
  ),
  blocked(
    "zoom_rooms_settings_content",
    "Block settings and content",
    "Meeting and phone passwords, calendars, device profiles, room settings, sensor data, recordings, participants, content, and communications data are not exposed.",
  ),
  blocked(
    "zoom_rooms_mutation_raw",
    "Block changes and raw API",
    "Room, device, location, tag, calendar, app, firmware, settings, and E911 changes plus arbitrary paths, filters, cursors, origins, and raw tokens are not exposed.",
  ),
];

export const ZOOM_ROOMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoom-rooms",
  name: "Zoom Rooms",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.zoom.us/docs/api/rooms/",
  providerWebsiteUrl: "https://www.zoom.com/en/products/meeting-rooms/",
  capabilities: [
    {
      ...capability(
        "fleet_health",
        "Read anonymous fleet health",
        "Inspect bounded Zoom Rooms availability and type metadata without room identity or controls.",
        true,
      ),
      platformCapability: "zoom_rooms_fleet_health",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ZOOM_ROOMS_ACCOUNT_ID",
        label: "Zoom account ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Account ID from a customer-owned Zoom Server-to-Server OAuth app restricted to the listed granular scope.",
      },
      {
        name: "ZOOM_ROOMS_CLIENT_ID",
        label: "Zoom Server-to-Server OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Client ID from the customer's dedicated Zoom Rooms app.",
      },
      {
        name: "ZOOM_ROOMS_CLIENT_SECRET",
        label: "Zoom Server-to-Server OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Railway stores the secret encrypted and uses it only at zoom.us/oauth/token.",
      },
    ],
  },
  tools: [
    {
      name: "zoomRooms.listFleetHealth",
      functionName: "zoom_rooms_fleet_list",
      aliases: ["zoomRooms.listFleetHealth", "zoom_rooms_fleet_list"],
      capability: "fleet_health",
      platformCapability: "zoom_rooms_fleet_health",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded page of anonymous Zoom Rooms fleet-health metadata.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId: { type: "string", minLength: 1, maxLength: 200 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoom_rooms_safe",
      label: "Safe",
      description:
        "Every organization-wide Zoom Rooms fleet-health read requires matching Relay approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected anonymous fleet reads run without Relay per-action approval while fixed origins, endpoint, bound, redaction, audit, scope, account roles, licensing, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "fleet_health",
      label: "Zoom Rooms fleet authorization",
      requiredScopes: [ZOOM_ROOMS_REQUIRED_SCOPE],
    },
  ],
};
