import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "luma_user_get",
    "Verify connected user",
    "Verify the API-key user binding and return only a bounded name and binding status.",
  ),
  action(
    "luma_calendar_get",
    "Read bound Calendar",
    "Read useful public fields for the one Calendar bound to the API key.",
  ),
  action(
    "luma_calendar_events_list",
    "List managed Events",
    "List at most ten approved Luma Events managed by the bound Calendar in an explicit date window.",
  ),
  action(
    "luma_event_get",
    "Read one Event",
    "Read one explicit Event managed by the bound Calendar without guest-only address or meeting details.",
  ),
];

const blocks = [
  blocked(
    "luma_mutations",
    "Block mutations",
    "Event, guest, registration, ticket, invite, host, contact, coupon, membership, webhook, calendar, and cancellation/refund writes are unavailable.",
  ),
  blocked(
    "luma_sensitive_reads",
    "Block sensitive reads",
    "Guests, contacts, registrations, answers, emails, meeting URLs, guest-only exact addresses, tickets, coupons, analytics, and check-in data are unavailable.",
  ),
  blocked(
    "luma_broad_raw",
    "Block broad and raw access",
    "Organization-wide access, externally managed Events, pending submissions, cursors, pagination, arbitrary filters, bulk work, and raw API access are unavailable.",
  ),
];

export const LUMA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "luma",
  name: "Luma",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.luma.com/reference/getting-started-with-your-api",
  providerWebsiteUrl: "https://luma.com/",
  capabilities: [
    {
      ...capability(
        "user_read",
        "Verify connected user",
        "Verify the exact user returned by the Calendar API key without exposing the provider user ID or email.",
        true,
      ),
      platformCapability: "luma_user_read",
    },
    {
      ...capability(
        "calendar_read",
        "Read bound Calendar",
        "Read useful bounded fields for the one Calendar to which the key is scoped.",
        true,
      ),
      platformCapability: "luma_calendar_read",
    },
    {
      ...capability(
        "event_read",
        "Read managed Events",
        "List bounded approved Events and inspect one explicit Event managed by the bound Calendar.",
        true,
      ),
      platformCapability: "luma_event_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LUMA_API_KEY",
        label: "Luma Calendar API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a key for one Luma Plus Calendar. Relay encrypts it and sends it only to public-api.luma.com in the x-luma-api-key header; the provider warns that this key has full Calendar access even though Relay exposes only four fixed reads.",
      },
    ],
  },
  tools: [
    {
      name: "relay_luma_get_user",
      functionName: "relay_luma_get_user",
      aliases: ["luma_user_get"],
      capability: "user_read",
      platformCapability: "luma_user_read",
      action: "read",
      approvalRequired: false,
      description:
        "Verify the API-key user binding without returning the provider user ID or email.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_luma_get_calendar",
      functionName: "relay_luma_get_calendar",
      aliases: ["luma_calendar_get"],
      capability: "calendar_read",
      platformCapability: "luma_calendar_read",
      action: "read",
      approvalRequired: false,
      description: "Read useful fields for the Calendar bound to the API key.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "relay_luma_list_calendar_events",
      functionName: "relay_luma_list_calendar_events",
      aliases: ["luma_calendar_events_list"],
      capability: "event_read",
      platformCapability: "luma_event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most ten approved Luma Events managed by the bound Calendar in an explicit date window.",
      inputSchema: {
        type: "object",
        properties: {
          after: { type: "string", format: "date-time", maxLength: 64 },
          before: { type: "string", format: "date-time", maxLength: 64 },
          limit: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["after"],
        additionalProperties: false,
      },
    },
    {
      name: "relay_luma_get_event",
      functionName: "relay_luma_get_event",
      aliases: ["luma_event_get"],
      capability: "event_read",
      platformCapability: "luma_event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one explicit Event managed by the bound Calendar.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            pattern: "^evt-[A-Za-z0-9_-]+$",
            maxLength: 128,
          },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "luma_safe",
      label: "Safe",
      description:
        "The four fixed bound-user, Calendar, and Event reads run automatically; sensitive, mutating, broad, paginated, and raw surfaces remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same four selected reads run without Relay per-action approval; exact key, user, and Calendar authority, fixed routes, bounds, audits, secret isolation, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "bound_calendar",
      label: "Luma API key, user, and Calendar binding",
    },
  ],
};
