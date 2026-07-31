import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "hopin_organization_get",
    "Read bound Organization",
    "Read bounded identity fields for the exact RingCentral Events Organization configured on the connection.",
  ),
  action(
    "hopin_organization_events_list",
    "List Organization Events",
    "List at most ten first-page Events owned by the bound Organization.",
  ),
  action(
    "hopin_event_get",
    "Read one Event",
    "Read one explicit Event from the bound Organization's first bounded page.",
  ),
  action(
    "hopin_event_schedule_items_list",
    "List Event Schedule Items",
    "List at most ten first-page Schedule Items for one bounded Organization Event.",
  ),
];

const blocks = [
  blocked(
    "hopin_mutations",
    "Block mutations",
    "Event, template, ticket, registration, magic-link, report, booth, session, stage, schedule, tag, data-subscription, and webhook mutations are unavailable.",
  ),
  blocked(
    "hopin_sensitive_reads",
    "Block sensitive reads",
    "Registrations, attendees, tickets, magic links, reports, analytics, engagement, booth contacts, speakers, emails, user IDs, and private metadata are unavailable.",
  ),
  blocked(
    "hopin_broad_raw",
    "Block broad and raw access",
    "Other Organizations, pages after the first ten Events or Schedule Items, cursors, arbitrary filters, bulk work, downloads, and raw API access are unavailable.",
  ),
];

export const HOPIN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hopin",
  name: "RingCentral Events",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.events.ringcentral.com/external-api/reference",
  providerWebsiteUrl: "https://www.ringcentral.com/rc-events",
  capabilities: [
    {
      ...capability(
        "organization_read",
        "Read bound Organization",
        "Read bounded identity for one exact RingCentral Events Organization.",
        true,
      ),
      platformCapability: "hopin_organization_read",
    },
    {
      ...capability(
        "event_read",
        "Read Organization Events",
        "List and inspect bounded Events belonging to the exact Organization.",
        true,
      ),
      platformCapability: "hopin_event_read",
    },
    {
      ...capability(
        "schedule_read",
        "Read Event Schedule",
        "List bounded Schedule Items without speaker or attendee data.",
        true,
      ),
      platformCapability: "hopin_schedule_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "RINGCENTRAL_EVENTS_ACCESS_TOKEN",
        label: "RingCentral Events OAuth bearer token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Provide a customer-owned Events API OAuth bearer token. Relay encrypts it and sends it only to api.events.ringcentral.com; the public developer portal does not document a distributable external consent/token lifecycle, so Relay does not invent one.",
      },
      {
        name: "RINGCENTRAL_EVENTS_ORGANIZATION_ID",
        label: "RingCentral Events Organization ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact Organization ID to bind this connection. Health verifies that the token can read that Organization.",
      },
    ],
  },
  tools: [
    {
      name: "relay_hopin_get_organization",
      functionName: "relay_hopin_get_organization",
      aliases: ["hopin_organization_get"],
      capability: "organization_read",
      platformCapability: "hopin_organization_read",
      action: "read",
      approvalRequired: false,
      description: "Read the exact bound RingCentral Events Organization.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_hopin_list_organization_events",
      functionName: "relay_hopin_list_organization_events",
      aliases: ["hopin_organization_events_list"],
      capability: "event_read",
      platformCapability: "hopin_event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most ten first-page Events for the bound Organization.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 10 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_hopin_get_event",
      functionName: "relay_hopin_get_event",
      aliases: ["hopin_event_get"],
      capability: "event_read",
      platformCapability: "hopin_event_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one explicit Event verified on the bound Organization's first page.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]+$",
            maxLength: 128,
          },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_hopin_list_event_schedule_items",
      functionName: "relay_hopin_list_event_schedule_items",
      aliases: ["hopin_event_schedule_items_list"],
      capability: "schedule_read",
      platformCapability: "hopin_schedule_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most ten first-page Schedule Items for one bounded Event.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]+$",
            maxLength: 128,
          },
          limit: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "hopin_safe",
      label: "Safe",
      description:
        "Four fixed Organization, Event, and Schedule reads run automatically; sensitive, mutating, broad, paginated, downloadable, and raw surfaces remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same four selected reads run without Relay per-action approval; exact token and Organization authority, fixed routes, bounds, audits, secret isolation, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "bound_organization",
      label: "RingCentral Events token and Organization binding",
    },
  ],
};
