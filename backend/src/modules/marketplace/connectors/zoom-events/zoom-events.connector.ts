import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
export const ZOOM_EVENTS_REQUIRED_SCOPE = "zoom_events:read:list_events:admin";
const reads = [
  action(
    "zoom_events_lifecycle_list",
    "List event lifecycle",
    "List one bounded page of content-free Zoom Events lifecycle metadata.",
  ),
];
const blockedActions = [
  blocked(
    "zoom_events_identity_content",
    "Block identity and content",
    "Event names, descriptions, taglines, IDs, hub IDs, URLs, contacts, physical locations, countries, categories, tags, calendars, recurrence detail, and raw records are not returned.",
  ),
  blocked(
    "zoom_events_people_access",
    "Block people and access",
    "Registrants, attendees, co-editors, speakers, exhibitors, sponsors, tickets, access links, authentication policy, invitations, email, and attendee actions are not exposed.",
  ),
  blocked(
    "zoom_events_sessions_reports_media",
    "Block sessions, reports, and media",
    "Session content, reservations, surveys, attendance, engagement, chat transcripts, custom reports, VOD, recordings, files, livestreams, and analytics are not exposed.",
  ),
  blocked(
    "zoom_events_mutation_raw",
    "Block changes and raw API",
    "Event/session/ticket/access/exhibitor/VOD changes, uploads, actions, and arbitrary paths, filters, cursors, origins, headers, bodies, or tokens are not exposed.",
  ),
];
export const ZOOM_EVENTS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoom-events",
  name: "Zoom Events",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.zoom.us/docs/api/events/",
  providerWebsiteUrl: "https://www.zoom.com/en/products/event-platform/",
  capabilities: [
    {
      ...capability(
        "lifecycle_read",
        "Read event lifecycle",
        "Inspect bounded content-free Zoom Events type, status, and schedule metadata.",
        true,
      ),
      platformCapability: "zoom_events_lifecycle_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ZOOM_EVENTS_ACCOUNT_ID",
        label: "Zoom account ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Account ID from a customer-owned Zoom Server-to-Server OAuth app restricted to the listed granular scope.",
      },
      {
        name: "ZOOM_EVENTS_CLIENT_ID",
        label: "Zoom Server-to-Server OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Client ID from the customer's dedicated Zoom Events app.",
      },
      {
        name: "ZOOM_EVENTS_CLIENT_SECRET",
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
      name: "zoomEvents.listLifecycle",
      functionName: "zoom_events_lifecycle_list",
      aliases: ["zoomEvents.listLifecycle", "zoom_events_lifecycle_list"],
      capability: "lifecycle_read",
      platformCapability: "zoom_events_lifecycle_read",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded page of content-free Zoom Events lifecycle metadata.",
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
      id: "zoom_events_safe",
      label: "Safe",
      description:
        "Every account-associated Zoom Events lifecycle read requires matching Relay approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected lifecycle reads run without Relay per-action approval while fixed origins, endpoint, bound, redaction, audit, scope, licensing, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "lifecycle_read",
      label: "Zoom Events lifecycle authorization",
      requiredScopes: [ZOOM_EVENTS_REQUIRED_SCOPE],
    },
  ],
};
