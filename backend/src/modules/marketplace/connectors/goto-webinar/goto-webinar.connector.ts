import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOTO_WEBINAR_REQUIRED_SCOPES = [
  "identity:scim.me",
  "collab:",
] as const;

const reads = [
  action(
    "goto_webinar_lifecycle_list",
    "List webinar lifecycle",
    "List one bounded page of content-free webinar lifecycle metadata for the authenticated organizer.",
  ),
];

const blockedActions = [
  blocked(
    "goto_webinar_identity_content",
    "Block webinar identity and content",
    "Webinar keys and IDs, subjects, descriptions, registration URLs, passwords, organizer/co-organizer identity, account keys, recording assets, and raw records are not returned.",
  ),
  blocked(
    "goto_webinar_people_engagement",
    "Block people and engagement",
    "Registrants, attendees, panelists, organizers, join links, registration fields and answers, questions, polls, surveys, attendance, and engagement are not exposed.",
  ),
  blocked(
    "goto_webinar_media_communications",
    "Block media and communications",
    "Recordings, transcripts, audio details, livestreams, emails, invitations, reminders, follow-ups, certificates, webhooks, and communications are not exposed.",
  ),
  blocked(
    "goto_webinar_mutation_raw",
    "Block changes and raw API",
    "Scheduling, copying, updating, cancelling, registration, people, media, webhook, and every other mutation plus arbitrary paths, IDs, filters, dates, pages, origins, bodies, and tokens are not exposed.",
  ),
];

export const GOTO_WEBINAR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "goto-webinar",
  name: "GoTo Webinar",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.goto.com/GoToWebinarV2",
  providerWebsiteUrl: "https://www.goto.com/webinar",
  capabilities: [
    {
      ...capability(
        "lifecycle_read",
        "Read webinar lifecycle",
        "Inspect a bounded content-free webinar schedule and experience summary for the authenticated organizer.",
        true,
      ),
      platformCapability: "goto_webinar_lifecycle_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://authentication.logmeininc.com/oauth/authorize",
      tokenUrl: "https://authentication.logmeininc.com/oauth/token",
      userInfoUrl: "https://api.getgo.com/identity/v1/Users/me",
      requiredScopes: [...GOTO_WEBINAR_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GOTO_WEBINAR_CLIENT_ID",
        label: "Relay GoTo Webinar OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Railway-held Relay OAuth client registered only for GoTo identity and collaboration access.",
      },
      {
        name: "GOTO_WEBINAR_CLIENT_SECRET",
        label: "Relay GoTo Webinar OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Railway-held confidential secret used only for GoTo code and rotating-refresh exchanges.",
      },
    ],
  },
  tools: [
    {
      name: "gotoWebinar.listLifecycle",
      functionName: "goto_webinar_lifecycle_list",
      aliases: ["gotoWebinar.listLifecycle", "goto_webinar_lifecycle_list"],
      capability: "lifecycle_read",
      platformCapability: "goto_webinar_lifecycle_read",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded page of content-free webinar lifecycle metadata for the authenticated organizer.",
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
      id: "goto_webinar_safe",
      label: "Safe",
      description:
        "Every authenticated-organizer webinar lifecycle read requires matching Relay approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected lifecycle reads run without Relay per-action approval while authenticated-organizer binding, fixed origins, endpoint, time window, first page, bounds, redaction, audits, OAuth scopes, licensing, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "lifecycle_read",
      label: "GoTo Webinar organizer authorization",
      requiredScopes: [...GOTO_WEBINAR_REQUIRED_SCOPES],
    },
  ],
};
