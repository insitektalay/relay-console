import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "goto_meeting_identity_get",
    "Verify connected organizer",
    "Verify the exact OAuth-authorized GoTo organizer without returning provider IDs or email addresses.",
  ),
  action(
    "goto_meeting_upcoming_list",
    "List upcoming Meetings",
    "List at most ten upcoming Meeting schedule summaries for the exact connected organizer.",
  ),
  action(
    "goto_meeting_get",
    "Read one bounded Meeting",
    "Read one Meeting only after its ID appears in the connected organizer's first ten upcoming Meetings.",
  ),
];

const blocks = [
  blocked(
    "goto_meeting_mutations",
    "Block mutations and launch actions",
    "Meeting create, update, delete, start, scheduling, co-organizer, session, room, and webhook writes are unavailable.",
  ),
  blocked(
    "goto_meeting_sensitive_adjacent",
    "Block sensitive adjacent data",
    "Organizer identities, join and host links, passwords, conference credentials, attendees, attendance, history, sessions, recordings, transcripts, AI summaries, and downloads are unavailable.",
  ),
  blocked(
    "goto_meeting_admin_other_raw",
    "Block administration, other products, and raw access",
    "Organizer, group, account, Admin, SCIM-management, Connect, Webinar, Training, Rescue, Resolve, other-organizer, later-result, export, bulk, and raw API access is unavailable.",
  ),
];

export const GOTO_MEETING_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "goto-meeting",
  name: "GoTo Meeting",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.goto.com/GoToMeetingV1",
  providerWebsiteUrl: "https://www.goto.com/meeting",
  capabilities: [
    {
      ...capability(
        "identity_read",
        "Verify connected organizer",
        "Verify the exact OAuth-bound organizer without exposing their provider identity.",
        true,
      ),
      platformCapability: "identity_read",
    },
    {
      ...capability(
        "meeting_list",
        "List upcoming Meetings",
        "List at most ten upcoming Meeting schedule summaries for the connected organizer.",
        true,
      ),
      platformCapability: "meeting_list",
    },
    {
      ...capability(
        "meeting_read",
        "Read one bounded Meeting",
        "Inspect one Meeting already verified in the first bounded upcoming set.",
        true,
      ),
      platformCapability: "meeting_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://authentication.logmeininc.com/oauth/authorize",
      tokenUrl: "https://authentication.logmeininc.com/oauth/token",
      userInfoUrl: "https://api.getgo.com/identity/v1/Users/me",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GOTO_MEETING_CLIENT_ID",
        label: "GoTo Meeting OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held client ID for a confidential OAuth client assigned only the GoTo Meeting product.",
      },
      {
        name: "GOTO_MEETING_CLIENT_SECRET",
        label: "GoTo Meeting OAuth client secret",
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
      name: "relay_goto_meeting_get_identity",
      functionName: "relay_goto_meeting_get_identity",
      aliases: ["goto_meeting_identity_get"],
      capability: "identity_read",
      platformCapability: "identity_read",
      action: "read",
      approvalRequired: false,
      description:
        "Verify the exact connected GoTo organizer without returning provider IDs or email addresses.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_goto_meeting_list_upcoming_meetings",
      functionName: "relay_goto_meeting_list_upcoming_meetings",
      aliases: ["goto_meeting_upcoming_list"],
      capability: "meeting_list",
      platformCapability: "meeting_list",
      action: "read",
      approvalRequired: false,
      description:
        "List at most ten upcoming Meeting schedule summaries for the connected organizer.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_goto_meeting_get_meeting",
      functionName: "relay_goto_meeting_get_meeting",
      aliases: ["goto_meeting_get"],
      capability: "meeting_read",
      platformCapability: "meeting_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one Meeting verified in the connected organizer's first ten upcoming Meetings.",
      inputSchema: {
        type: "object",
        properties: {
          meetingId: { type: "string", pattern: "^[0-9]{1,20}$" },
        },
        required: ["meetingId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "goto_meeting_safe",
      label: "Safe",
      description:
        "The three selected fixed reads run automatically; identities, join data, sensitive artifacts, mutations, broad authority, later results, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three reads run without Relay per-action approval; exact organizer authority, a Meeting-only client, fixed routes, bounds, audits, and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "connected_organizer",
      label: "Connected GoTo organizer and conditionally rotating token",
      requiredScopes: [],
    },
  ],
};
