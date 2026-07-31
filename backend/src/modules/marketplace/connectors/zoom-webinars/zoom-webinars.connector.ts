import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ZOOM_WEBINARS_REQUIRED_SCOPE = "webinar:read:list_webinars:admin";
const reads = [
  action(
    "zoom_webinars_lifecycle_list",
    "List webinar lifecycle",
    "List one bounded page of content-free webinar schedule and type metadata for one configured host.",
  ),
];
const blockedActions = [
  blocked(
    "zoom_webinars_identity_content",
    "Block identity and content",
    "Topics, agendas, webinar UUIDs and IDs, host identity, join/start URLs, passwords, invite links, tracking data, custom questions, and raw records are not returned.",
  ),
  blocked(
    "zoom_webinars_people_engagement",
    "Block people and engagement",
    "Registrants, panelists, participants, absentees, attendance, contacts, Q&A, polls, surveys, chat, feedback, reactions, and engagement analytics are not exposed.",
  ),
  blocked(
    "zoom_webinars_media_ai",
    "Block media and AI",
    "Recordings, transcripts, summaries, AI Companion conversations, archives, livestreams, branding assets, local tokens, and real-time media are not exposed.",
  ),
  blocked(
    "zoom_webinars_mutation_raw",
    "Block changes and raw API",
    "Creation, update, deletion, status changes, registration, invitations, branding, livestreaming, and arbitrary paths, hosts, filters, cursors, origins, or tokens are not exposed.",
  ),
];
export const ZOOM_WEBINARS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoom-webinars",
  name: "Zoom Webinars",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.zoom.us/docs/api/meetings/",
  providerWebsiteUrl: "https://www.zoom.com/en/products/webinars/",
  capabilities: [
    {
      ...capability(
        "lifecycle_read",
        "Read webinar lifecycle",
        "Inspect bounded content-free schedule and type metadata for one configured webinar host.",
        true,
      ),
      platformCapability: "zoom_webinars_lifecycle_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ZOOM_WEBINARS_ACCOUNT_ID",
        label: "Zoom account ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Account ID from a customer-owned Server-to-Server OAuth app restricted to the listed granular scope.",
      },
      {
        name: "ZOOM_WEBINARS_CLIENT_ID",
        label: "Zoom Server-to-Server OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Client ID from the customer's dedicated Zoom Webinars app.",
      },
      {
        name: "ZOOM_WEBINARS_CLIENT_SECRET",
        label: "Zoom Server-to-Server OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Railway stores the secret encrypted and uses it only at zoom.us/oauth/token.",
      },
      {
        name: "ZOOM_WEBINARS_HOST_ID",
        label: "Authorized webinar host ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Exact licensed host ID fixed on the connection and never exposed to agents or results.",
      },
    ],
  },
  tools: [
    {
      name: "zoomWebinars.listLifecycle",
      functionName: "zoom_webinars_lifecycle_list",
      aliases: ["zoomWebinars.listLifecycle", "zoom_webinars_lifecycle_list"],
      capability: "lifecycle_read",
      platformCapability: "zoom_webinars_lifecycle_read",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded page of content-free webinar lifecycle metadata.",
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
      id: "zoom_webinars_safe",
      label: "Safe",
      description:
        "Every host-bound webinar lifecycle read requires matching Relay approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected lifecycle reads run without Relay per-action approval while fixed origins, host binding, endpoint, bound, redaction, audit, scope, licensing, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "lifecycle_read",
      label: "Zoom Webinars host authorization",
      requiredScopes: [ZOOM_WEBINARS_REQUIRED_SCOPE],
    },
  ],
};
