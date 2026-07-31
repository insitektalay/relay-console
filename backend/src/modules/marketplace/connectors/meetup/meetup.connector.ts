import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "meetup_self_get",
    "Read connected member",
    "Verify the OAuth-authorized member and return only a bounded display name and binding status.",
  ),
  action(
    "meetup_event_get",
    "Read one event",
    "Read fixed useful fields for one explicitly supplied Meetup event ID.",
  ),
];
const blocks = [
  blocked(
    "meetup_mutations",
    "Block mutations",
    "Event, group, network, RSVP, attendance, announcement, message, payment, and ticket mutations are not exposed.",
  ),
  blocked(
    "meetup_broad_reads",
    "Block broad reads",
    "Member lists, analytics, discovery, search, bulk, pagination, exports, photos, files, and webhooks are not exposed.",
  ),
  blocked(
    "meetup_raw_graphql",
    "Block raw GraphQL",
    "Arbitrary queries, schema introspection, fragments, aliases, and raw GraphQL are not exposed.",
  ),
];

export const MEETUP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "meetup",
  name: "Meetup",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.meetup.com/graphql/guide/",
  providerWebsiteUrl: "https://www.meetup.com/",
  capabilities: [
    {
      ...capability(
        "self_read",
        "Read connected member",
        "Verify the connected member ID and name.",
        true,
      ),
      platformCapability: "self_read",
    },
    {
      ...capability(
        "event_read",
        "Read one event",
        "Review one explicitly identified event with fixed useful fields.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://secure.meetup.com/oauth2/authorize",
      tokenUrl: "https://secure.meetup.com/oauth2/access",
      userInfoUrl: "https://api.meetup.com/gql-ext",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "MEETUP_CLIENT_ID",
        label: "Meetup OAuth consumer key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held client approved for the Relay Meetup integration.",
      },
      {
        name: "MEETUP_CLIENT_SECRET",
        label: "Meetup OAuth consumer secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held confidential secret; never entered in RelayConsoleSwift.",
      },
    ],
  },
  tools: [
    {
      name: "relay_meetup_get_self",
      functionName: "relay_meetup_get_self",
      aliases: ["meetup_self_get"],
      capability: "self_read",
      platformCapability: "self_read",
      action: "read",
      approvalRequired: false,
      description:
        "Verify the connected Meetup member and return a bounded display name without exposing the provider member ID.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_meetup_get_event",
      functionName: "relay_meetup_get_event",
      aliases: ["meetup_event_get"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one Meetup event by explicit event ID.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: { type: "string", minLength: 1, maxLength: 128 },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "meetup_safe",
      label: "Safe",
      description:
        "The connected-member verification and one explicit-event fixed read run automatically; broader and raw GraphQL access remains blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same two selected reads run without Relay per-action approval; exact connection binding, query and response bounds, audits, and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "meetup_read_only",
      label: "Read only",
      description: "Compatibility profile for the same two fixed reads.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "meetup_no_access",
      label: "No access",
      description: "All Meetup actions are blocked.",
      defaultSelected: false,
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [...blocks, ...reads],
    },
  ],
  healthChecks: [
    {
      id: "connected_member",
      label: "Connected member and OAuth refresh",
      requiredScopes: [],
    },
  ],
};
