import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_MEET_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/meetings.space.created",
];

const reads = [
  action(
    "google_meet_space_get",
    "Get meeting space",
    "Read safe metadata for one explicit Relay-app-created Space.",
  ),
  action(
    "google_meet_space_update_prepare",
    "Prepare meeting space update",
    "Validate safe Space creation or patch locally.",
  ),
];
const writes = [
  action(
    "google_meet_space_create",
    "Create meeting space",
    "Create one safely configured app-created Space.",
  ),
  action(
    "google_meet_space_patch",
    "Update meeting space",
    "Patch one app-created Space with a forced safety configuration and explicit update mask.",
  ),
];
const blockedActions = [
  blocked(
    "google_meet_end_conference",
    "End active conference",
    "Active-conference termination is blocked in V1.",
  ),
  blocked(
    "google_meet_open_unmoderated",
    "Use open or unmoderated meeting settings",
    "Open access, moderation off, unrestricted participant features, attendance, and automatic artifacts are blocked.",
  ),
  blocked(
    "google_meet_participants_sessions",
    "Access meeting participants",
    "Participant identities, attendance, devices, and participant sessions are outside V1.",
  ),
  blocked(
    "google_meet_conference_records",
    "Access conference records",
    "Conference record identifiers and lifecycle data are outside V1.",
  ),
  blocked(
    "google_meet_artifacts",
    "Access meeting artifacts",
    "Recordings, transcripts, smart notes, Drive files, dial-in, and SIP details are outside V1.",
  ),
  blocked(
    "google_meet_events_media_hardware",
    "Use Meet events, media, or hardware APIs",
    "Events, media streams, eCDN, hardware, and add-on surfaces are outside V1.",
  ),
  blocked(
    "google_meet_broad_scopes_drive",
    "Use broad Meet or Drive scopes",
    "Broader Meet and restricted recording or transcript Drive scopes are forbidden.",
  ),
  blocked(
    "google_meet_raw_delegation",
    "Run raw or delegated Meet access",
    "Raw endpoints, automatic pagination, service accounts, and domain delegation are blocked.",
  ),
];
const spaceName = {
  type: "string",
  minLength: 8,
  maxLength: 256,
  pattern: "^spaces/[A-Za-z0-9_-]+$",
};
const safeConfiguration = {
  accessType: { type: "string", enum: ["RESTRICTED", "TRUSTED"] },
  entryPointAccess: { type: "string", enum: ["ALL", "CREATOR_APP_ONLY"] },
};
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const GOOGLE_MEET_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-meet",
  name: "Google Meet",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.google.com/workspace/meet/api/guides/overview",
  providerWebsiteUrl: "https://meet.google.com/",
  capabilities: [
    {
      ...capability(
        "space_read",
        "Read meeting spaces",
        "Read bounded metadata for explicit Spaces created by Relay's app.",
        true,
      ),
      platformCapability: "google_meet_space_read",
    },
    {
      ...capability(
        "space_draft",
        "Prepare Space changes",
        "Validate and preview forced-safe Space configuration locally.",
        true,
      ),
      platformCapability: "google_meet_space_draft",
    },
    {
      ...capability(
        "space_write",
        "Create and update Spaces",
        "Create or patch safely moderated app-created Spaces.",
        true,
      ),
      platformCapability: "google_meet_space_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_MEET_SCOPES,
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
      name: "googleMeet.getSpace",
      functionName: "google_meet_space_get",
      aliases: ["google_meet_space_get"],
      capability: "space_read",
      platformCapability: "google_meet_space_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read safe configuration and join coordination for one explicit app-created Space.",
      inputSchema: {
        type: "object",
        properties: { spaceName },
        required: ["spaceName"],
        additionalProperties: false,
      },
    },
    {
      name: "googleMeet.prepareSpaceUpdate",
      functionName: "google_meet_space_update_prepare",
      aliases: ["google_meet_space_update_prepare"],
      capability: "space_draft",
      platformCapability: "google_meet_space_draft",
      action: "draft",
      approvalRequired: false,
      description:
        "Validate and preview one forced-safe Space create or patch locally.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["create", "patch"] },
          spaceName,
          ...safeConfiguration,
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "googleMeet.createSpace",
      functionName: "google_meet_space_create",
      aliases: ["google_meet_space_create"],
      capability: "space_write",
      platformCapability: "google_meet_space_write",
      action: "write",
      approvalRequired: true,
      description:
        "Create one app-owned Space with restricted or trusted access and forced moderation controls.",
      inputSchema: {
        type: "object",
        properties: { ...safeConfiguration, approvalId },
        required: ["approvalId"],
        additionalProperties: false,
      },
    },
    {
      name: "googleMeet.updateSpace",
      functionName: "google_meet_space_patch",
      aliases: ["google_meet_space_patch"],
      capability: "space_write",
      platformCapability: "google_meet_space_write",
      action: "write",
      approvalRequired: true,
      description:
        "Patch one exact app-created Space using an explicit forced-safety update mask.",
      inputSchema: {
        type: "object",
        properties: { spaceName, ...safeConfiguration, approvalId },
        required: ["spaceName", "approvalId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "google_meet_safe",
      label: "Safe",
      description:
        "Explicit app-created Space reads and local preparation run automatically; safe create and patch require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected tools run without Relay per-action approval while exact app-created scope, moderated configuration, privacy redaction, audit, refresh, revocation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "app-created-safe-spaces",
      label:
        "Google account, exact app-created Space scope, safe configuration, and privacy redaction",
      requiredScopes: GOOGLE_MEET_SCOPES,
    },
  ],
};
