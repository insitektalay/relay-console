import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const WEBEX_SCOPES = ["spark:people_read", "meeting:schedules_read"];

const reads = [
  action(
    "webex_person_get",
    "Verify connected Person",
    "Verify the exact OAuth-authorized Webex Person without returning provider IDs or email addresses.",
  ),
  action(
    "webex_meetings_list",
    "List Meetings",
    "List at most ten first-page Meetings accessible to the connected Person.",
  ),
  action(
    "webex_meeting_get",
    "Read one Meeting",
    "Read one Meeting only after its ID appears in the connected Person's first bounded page.",
  ),
];

const blocks = [
  blocked(
    "webex_mutations",
    "Block mutations",
    "Meeting create, update, delete, cancel, scheduling, invitee, registration, webhook, and meeting-control writes are unavailable.",
  ),
  blocked(
    "webex_sensitive_adjacent",
    "Block sensitive adjacent data",
    "Invitees, registrants, attendees, participants, transcripts, recordings, summaries, chats, polls, Q&A, meeting numbers, host identities, and join or start links are unavailable.",
  ),
  blocked(
    "webex_other_products_raw",
    "Block other products and raw access",
    "Messaging, Calling, Contact Center, devices, administration, SCIM, compliance, analytics, People search, pages after the first ten Meetings, exports, bulk work, and raw API access are unavailable.",
  ),
];

export const WEBEX_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "webex",
  name: "Webex",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.webex.com/meeting/docs/meetings",
  providerWebsiteUrl: "https://www.webex.com/",
  capabilities: [
    {
      ...capability(
        "person_read",
        "Verify connected Person",
        "Verify the exact OAuth-bound Person without exposing their provider identity.",
        true,
      ),
      platformCapability: "person_read",
    },
    {
      ...capability(
        "meeting_list",
        "List Meetings",
        "List at most ten first-page Meeting schedule summaries.",
        true,
      ),
      platformCapability: "meeting_list",
    },
    {
      ...capability(
        "meeting_read",
        "Read one bounded Meeting",
        "Inspect one Meeting already verified in the first bounded page.",
        true,
      ),
      platformCapability: "meeting_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://webexapis.com/v1/authorize",
      tokenUrl: "https://webexapis.com/v1/access_token",
      userInfoUrl: "https://webexapis.com/v1/people/me",
      requiredScopes: WEBEX_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "WEBEX_CLIENT_ID",
        label: "Webex Integration client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held client ID for the registered Relay Webex Integration.",
      },
      {
        name: "WEBEX_CLIENT_SECRET",
        label: "Webex Integration client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held confidential secret; never entered in Relay Console clients.",
      },
    ],
  },
  tools: [
    {
      name: "relay_webex_get_person",
      functionName: "relay_webex_get_person",
      aliases: ["webex_person_get"],
      capability: "person_read",
      platformCapability: "person_read",
      action: "read",
      approvalRequired: false,
      description:
        "Verify the exact connected Webex Person without returning provider IDs or email addresses.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_webex_list_meetings",
      functionName: "relay_webex_list_meetings",
      aliases: ["webex_meetings_list"],
      capability: "meeting_list",
      platformCapability: "meeting_list",
      action: "read",
      approvalRequired: false,
      description: "List at most ten first-page Webex Meeting summaries.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_webex_get_meeting",
      functionName: "relay_webex_get_meeting",
      aliases: ["webex_meeting_get"],
      capability: "meeting_read",
      platformCapability: "meeting_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one Meeting verified in the connected Person's first ten Meetings.",
      inputSchema: {
        type: "object",
        properties: {
          meetingId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]+$",
            maxLength: 256,
          },
        },
        required: ["meetingId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "webex_safe",
      label: "Safe",
      description:
        "The three selected fixed reads run automatically; sensitive, mutating, broad, paginated, downloadable, and raw surfaces remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three reads run without Relay per-action approval; exact Person authority, minimal scopes, fixed routes, bounds, audits, and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "connected_person",
      label: "Connected Webex Person and rotating token",
      requiredScopes: WEBEX_SCOPES,
    },
  ],
};
