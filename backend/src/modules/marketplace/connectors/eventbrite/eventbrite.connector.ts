import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "eventbrite_user_get",
    "Read connected user",
    "Verify the OAuth-authorized Eventbrite user and return only a bounded name and binding status.",
  ),
  action(
    "eventbrite_organizations_list",
    "List member Organizations",
    "List at most ten Organizations for the connected user.",
  ),
  action(
    "eventbrite_organization_events_list",
    "List Organization Events",
    "List at most ten Events for one verified member Organization.",
  ),
  action(
    "eventbrite_event_get",
    "Read one Event",
    "Read one explicit Event with bounded Venue fields.",
  ),
];
const blocks = [
  blocked(
    "eventbrite_mutations",
    "Block mutations",
    "Event, ticket, checkout, order, attendee, refund, check-in, webhook, marketing and administration writes are not exposed.",
  ),
  blocked(
    "eventbrite_sensitive_reads",
    "Block sensitive reads",
    "Attendees, orders, tickets, payments, contacts, members, roles, exports and analytics are not exposed.",
  ),
  blocked(
    "eventbrite_broad_raw",
    "Block broad and raw access",
    "Discovery, arbitrary expansions, cursors, pagination, bulk, Manage ESR and raw API access are not exposed.",
  ),
];

export const EVENTBRITE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "eventbrite",
  name: "Eventbrite",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.eventbrite.com/platform/docs/",
  providerWebsiteUrl: "https://www.eventbrite.com/",
  capabilities: [
    {
      ...capability(
        "user_read",
        "Read connected user",
        "Verify the connected Eventbrite user.",
        true,
      ),
      platformCapability: "user_read",
    },
    {
      ...capability(
        "organization_read",
        "List member Organizations",
        "List at most ten Organizations for the connected user.",
        true,
      ),
      platformCapability: "organization_read",
    },
    {
      ...capability(
        "organization_event_read",
        "List Organization Events",
        "List at most ten Events for a verified member Organization.",
        true,
      ),
      platformCapability: "organization_event_read",
    },
    {
      ...capability(
        "event_read",
        "Read one Event",
        "Inspect one Event with bounded Venue fields.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.eventbrite.com/oauth/authorize",
      tokenUrl: "https://www.eventbrite.com/oauth/token",
      userInfoUrl: "https://www.eventbriteapi.com/v3/users/me/",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "EVENTBRITE_API_KEY",
        label: "Eventbrite app key",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held app key approved for the Relay Eventbrite integration.",
      },
      {
        name: "EVENTBRITE_CLIENT_SECRET",
        label: "Eventbrite client secret",
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
      name: "relay_eventbrite_get_user",
      functionName: "relay_eventbrite_get_user",
      aliases: ["eventbrite_user_get"],
      capability: "user_read",
      platformCapability: "user_read",
      action: "read",
      approvalRequired: false,
      description:
        "Verify the connected Eventbrite user without exposing the provider user ID.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_eventbrite_list_organizations",
      functionName: "relay_eventbrite_list_organizations",
      aliases: ["eventbrite_organizations_list"],
      capability: "organization_read",
      platformCapability: "organization_read",
      action: "read",
      approvalRequired: false,
      description: "List at most ten member Organizations.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_eventbrite_list_organization_events",
      functionName: "relay_eventbrite_list_organization_events",
      aliases: ["eventbrite_organization_events_list"],
      capability: "organization_event_read",
      platformCapability: "organization_event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most ten Events for a verified member Organization.",
      inputSchema: {
        type: "object",
        properties: {
          organizationId: {
            type: "string",
            pattern: "^[0-9]+$",
            maxLength: 64,
          },
          limit: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["organizationId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_eventbrite_get_event",
      functionName: "relay_eventbrite_get_event",
      aliases: ["eventbrite_event_get"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one explicit Event with bounded Venue fields.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: { type: "string", pattern: "^[0-9]+$", maxLength: 64 },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "eventbrite_safe",
      label: "Safe",
      description:
        "The four fixed connected-user, Organization and Event reads run automatically; sensitive, write, broad and raw surfaces remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same four selected reads run without Relay per-action approval; exact user and Organization authority, endpoint and response bounds, audits, and secret isolation still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "eventbrite_read_only",
      label: "Read only",
      description: "Compatibility profile for the same four fixed reads.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "eventbrite_no_access",
      label: "No access",
      description: "All Eventbrite actions are blocked.",
      defaultSelected: false,
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [...blocks, ...reads],
    },
  ],
  healthChecks: [
    {
      id: "connected_user",
      label: "Connected Eventbrite user",
      requiredScopes: [],
    },
  ],
};
