import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "splash_events_list",
    "List events",
    "List at most twenty-five Splash event summaries from page one.",
  ),
  action(
    "splash_event_get",
    "Read an event",
    "Read one exact Splash event metadata summary.",
  ),
];
const blocks = [
  blocked(
    "splash_people_data",
    "Block people data",
    "Guests, contacts, email, RSVP answers, QR codes, campaigns, unsubscribe state and attendee analytics are not exposed.",
  ),
  blocked(
    "splash_mutations",
    "Block mutations",
    "Event, workflow, guest, contact, unsubscribe, team and CRM event writes are not exposed.",
  ),
  blocked(
    "splash_raw_api",
    "Block raw API access",
    "Arbitrary view groups, filters, pages, bulk operations and raw responses are not exposed.",
  ),
];

export const SPLASH_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "splash",
  name: "Splash",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api-docs.splashthat.com/",
  providerWebsiteUrl: "https://splashthat.com/",
  capabilities: [
    {
      ...capability(
        "event_read",
        "Read event metadata",
        "List bounded Splash event summaries and inspect one exact event without guest or contact data.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SPLASH_CLIENT_ID",
        label: "Splash API client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Obtain the customer-specific client from Splash Customer Success.",
      },
      {
        name: "SPLASH_CLIENT_SECRET",
        label: "Splash API client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Store the Customer Success-issued secret encrypted.",
      },
      {
        name: "SPLASH_API_USERNAME",
        label: "Splash API username",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Use a dedicated customer-controlled API user email.",
      },
      {
        name: "SPLASH_API_PASSWORD",
        label: "Splash API user password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Splash's documented password grant requires this encrypted customer-controlled credential.",
      },
    ],
  },
  tools: [
    {
      name: "relay_splash_list_events",
      functionName: "relay_splash_list_events",
      aliases: ["splash_events_list"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five Splash event summaries from page one.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_splash_get_event",
      functionName: "relay_splash_get_event",
      aliases: ["splash_event_get"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact numeric Splash event metadata summary.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "splash_safe",
      label: "Safe",
      description:
        "Bounded event metadata reads run directly; guest/contact data, writes, bulk and raw API access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same complete selected read surface runs without Relay per-action approval; credential ownership, fixed origin, bounds, redaction and provider authority still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [{ id: "events_page", label: "Bounded Splash events page" }],
};
