import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ZOOM_SCOPES = [
  "meeting:read:list_meetings",
  "meeting:read:list_upcoming_meetings",
  "meeting:read:meeting",
];

const reads = [
  action(
    "zoom_scheduled_meetings_list",
    "List scheduled Zoom meetings",
    "Read up to twenty-five safe scheduled meeting metadata records for the signed-in user.",
  ),
  action(
    "zoom_live_meetings_list",
    "List live Zoom meetings",
    "Read up to twenty-five safe live meeting metadata records for the signed-in user.",
  ),
  action(
    "zoom_upcoming_meetings_list",
    "List upcoming Zoom meetings",
    "Read up to twenty-five safe next-24-hour meeting metadata records for the signed-in user.",
  ),
  action(
    "zoom_meeting_get",
    "Get Zoom meeting",
    "Read safe metadata for one explicit numeric meeting ID returned by a previous result.",
  ),
];

const blockedActions = [
  blocked(
    "zoom_join_start_registration_credentials",
    "Access meeting credentials",
    "Start, join, and registration URLs, passwords, passcodes, tokens, invitations, and dial-in details are always excluded.",
  ),
  blocked(
    "zoom_hosts_registrants_participants",
    "Access people data",
    "Host, alternative-host, invitee, registrant, participant, attendance, contact, and calendar data are outside V1.",
  ),
  blocked(
    "zoom_recordings_transcripts_chat_summaries",
    "Access meeting content",
    "Recordings, transcripts, chat, AI summaries, notes, and other meeting content are outside V1.",
  ),
  blocked(
    "zoom_assets_polls_media",
    "Access assets or interactive content",
    "Files, assets, polls, Q&A, audio, video, media, and streaming are outside V1.",
  ),
  blocked(
    "zoom_webinars_rooms_phone_team_chat",
    "Access other Zoom products",
    "Webinars, Events, Rooms, Phone, Team Chat, Whiteboard, and other Zoom products are outside V1.",
  ),
  blocked(
    "zoom_account_admin_writes",
    "Change or administer Zoom",
    "Account and admin access plus create, update, delete, end, and every other mutation are outside V1.",
  ),
  blocked(
    "zoom_webhooks_pagination_raw",
    "Use broad or raw access",
    "Webhooks, automatic pagination, polling, retries, raw provider requests, GraphQL, and MCP surfaces are outside V1.",
  ),
];

export const ZOOM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoom",
  name: "Zoom",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.zoom.us/docs/api/meetings/",
  providerWebsiteUrl: "https://zoom.us/",
  capabilities: [
    {
      ...capability(
        "scheduled_meetings",
        "Read scheduled meetings",
        "Review bounded safe scheduled and live meeting metadata for the signed-in user.",
        true,
      ),
      platformCapability: "zoom_scheduled_meetings_read",
    },
    {
      ...capability(
        "upcoming_meetings",
        "Read upcoming meetings",
        "Review bounded safe meeting metadata for the signed-in user's next twenty-four hours.",
        true,
      ),
      platformCapability: "zoom_upcoming_meetings_read",
    },
    {
      ...capability(
        "meeting_get",
        "Read one meeting",
        "Review safe metadata for one explicit numeric meeting ID from a previous result.",
        true,
      ),
      platformCapability: "zoom_meeting_metadata_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://zoom.us/oauth/authorize",
      tokenUrl: "https://zoom.us/oauth/token",
      requiredScopes: ZOOM_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "ZOOM_CLIENT_ID",
        label: "Zoom OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth"],
        helpText: "Relay-owned Zoom app client ID configured only on Railway.",
      },
      {
        name: "ZOOM_CLIENT_SECRET",
        label: "Zoom OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth"],
        helpText: "Relay-owned Zoom app secret retained only by Railway.",
      },
    ],
  },
  tools: [
    {
      name: "zoom.listScheduledMeetings",
      functionName: "zoom_scheduled_meetings_list",
      aliases: [
        "zoom.listScheduledMeetings",
        "relay_zoom_list_scheduled_meetings",
      ],
      capability: "scheduled_meetings",
      platformCapability: "zoom_scheduled_meetings_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read up to twenty-five scheduled meetings for the signed-in user.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "zoom.listLiveMeetings",
      functionName: "zoom_live_meetings_list",
      aliases: ["zoom.listLiveMeetings", "relay_zoom_list_live_meetings"],
      capability: "scheduled_meetings",
      platformCapability: "zoom_scheduled_meetings_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read up to twenty-five live meetings for the signed-in user.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "zoom.listUpcomingMeetings",
      functionName: "zoom_upcoming_meetings_list",
      aliases: [
        "zoom.listUpcomingMeetings",
        "relay_zoom_list_upcoming_meetings",
      ],
      capability: "upcoming_meetings",
      platformCapability: "zoom_upcoming_meetings_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read up to twenty-five meetings in the signed-in user's next twenty-four hours.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "zoom.getMeeting",
      functionName: "zoom_meeting_get",
      aliases: ["zoom.getMeeting", "relay_zoom_get_meeting"],
      capability: "meeting_get",
      platformCapability: "zoom_meeting_metadata_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read safe metadata for one explicit numeric prior-result meeting ID.",
      inputSchema: {
        type: "object",
        properties: { meetingId: { type: "string", pattern: "^[0-9]{1,32}$" } },
        required: ["meetingId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoom_safe",
      label: "Safe",
      description:
        "Four fixed self-user meeting metadata GET reads run automatically; credentials, people, content, other Zoom products, writes, administration, webhooks, pagination, and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same four reads run without Relay per-action approval; exact scopes, self-user routing, safe projections, limits, audit, and API controls still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "self_user_meetings",
      label:
        "Zoom user-managed OAuth, exact granular scopes, refresh token, and signed-in-user meetings validation",
      requiredScopes: ZOOM_SCOPES,
    },
  ],
};
