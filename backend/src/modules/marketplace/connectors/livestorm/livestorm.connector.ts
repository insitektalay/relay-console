import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const LIVESTORM_REQUIRED_SCOPES = [
  "identity:read",
  "events:read",
] as const;

const reads = [
  action(
    "livestorm_event_lifecycle_list",
    "List event lifecycle",
    "List one bounded first page of content-free event lifecycle metadata for the connected Livestorm workspace.",
  ),
];

const blockedActions = [
  blocked(
    "livestorm_identity_content",
    "Block identity and event content",
    "Event, session, organization, owner, and people IDs plus titles, descriptions, slugs, registration and room links, form fields, tags, and raw records are not returned.",
  ),
  blocked(
    "livestorm_people_engagement",
    "Block people and engagement",
    "Registrants, attendees, hosts, moderators, guest speakers, contact details, answers, chat, questions, polls, votes, surveys, attendance, and engagement are not exposed.",
  ),
  blocked(
    "livestorm_media_communications",
    "Block media and communications",
    "Recordings, replay URLs, transcripts, audio, livestreams, emails, invitations, reminders, webhooks, and communications are not exposed.",
  ),
  blocked(
    "livestorm_mutation_raw",
    "Block changes and raw API",
    "Event and session creation, updates, publication, cancellation, registration, people, media, webhook, and every other mutation plus arbitrary paths, filters, includes, pages, origins, bodies, and tokens are not exposed.",
  ),
];

export const LIVESTORM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "livestorm",
  name: "Livestorm",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.livestorm.co/docs/getting-started-api",
  providerWebsiteUrl: "https://livestorm.co",
  capabilities: [
    {
      ...capability(
        "event_lifecycle_read",
        "Read event lifecycle",
        "Inspect one bounded first page of content-free Livestorm event lifecycle metadata.",
        true,
      ),
      platformCapability: "livestorm_event_lifecycle_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.livestorm.co/oauth/authorize",
      tokenUrl: "https://app.livestorm.co/oauth/token",
      userInfoUrl: "https://api.livestorm.co/v1/me",
      requiredScopes: [...LIVESTORM_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "LIVESTORM_CLIENT_ID",
        label: "Relay Livestorm OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Railway-held Relay Technology Partner client registered only for identity and event reads.",
      },
      {
        name: "LIVESTORM_CLIENT_SECRET",
        label: "Relay Livestorm OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["oauth"],
        helpText:
          "Railway-held confidential secret used only for authorization-code and refresh exchanges.",
      },
    ],
  },
  tools: [
    {
      name: "livestorm.listEventLifecycle",
      functionName: "livestorm_event_lifecycle_list",
      aliases: [
        "livestorm.listEventLifecycle",
        "livestorm_event_lifecycle_list",
      ],
      capability: "event_lifecycle_read",
      platformCapability: "livestorm_event_lifecycle_read",
      action: "read",
      approvalRequired: true,
      description:
        "List one bounded first page of content-free event lifecycle metadata for the connected Livestorm workspace.",
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
      id: "livestorm_safe",
      label: "Safe",
      description:
        "Every connected-workspace event lifecycle read requires matching Relay approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected lifecycle reads run without Relay per-action approval while connected-workspace binding, fixed origins and endpoints, first-page bounds, redaction, audits, exact OAuth scopes, workspace validation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "event_lifecycle_read",
      label: "Livestorm workspace authorization",
      requiredScopes: [...LIVESTORM_REQUIRED_SCOPES],
    },
  ],
};
