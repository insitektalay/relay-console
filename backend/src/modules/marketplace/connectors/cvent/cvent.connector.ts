import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [
  action(
    "cvent_events_list",
    "List events",
    "List at most twenty-five Cvent event summaries from one page.",
  ),
  action(
    "cvent_event_get",
    "Read an event",
    "Read one exact Cvent event metadata summary.",
  ),
];
const blocks = [
  blocked(
    "cvent_people_data",
    "Block people data",
    "Contacts, attendees, registrations, admission items, speakers, exhibitors, travel, payments, surveys and custom fields are not exposed.",
  ),
  blocked(
    "cvent_mutations",
    "Block mutations",
    "Event, contact, attendee, session, webhook, registration and hospitality writes are not exposed.",
  ),
  blocked(
    "cvent_raw_api",
    "Block raw API access",
    "Arbitrary resources, filters, continuation tokens, bulk operations and raw responses are not exposed.",
  ),
];
export const CVENT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "cvent",
  name: "Cvent",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.cvent.com/docs/rest-api/overview",
  providerWebsiteUrl: "https://www.cvent.com/",
  capabilities: [
    {
      ...capability(
        "event_read",
        "Read event metadata",
        "List bounded Cvent event summaries and inspect one exact event under event/events:read.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CVENT_CLIENT_ID",
        label: "Cvent API client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a customer-owned Cvent REST API client with only event/events:read.",
      },
      {
        name: "CVENT_CLIENT_SECRET",
        label: "Cvent API client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Store the customer-owned client secret encrypted.",
      },
      {
        name: "CVENT_REGION",
        label: "Cvent region",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Select US or EMEA to pin the matching documented API origin.",
      },
    ],
  },
  tools: [
    {
      name: "relay_cvent_list_events",
      functionName: "relay_cvent_list_events",
      aliases: ["cvent_events_list"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five Cvent event summaries without following continuation tokens.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_cvent_get_event",
      functionName: "relay_cvent_get_event",
      aliases: ["cvent_event_get"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact Cvent event metadata summary.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            pattern: "^[A-Za-z0-9][A-Za-z0-9-]{0,127}$",
          },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "cvent_safe",
      label: "Safe",
      description:
        "Bounded event metadata reads run directly; people, registration, payments, writes, bulk and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same complete selected read surface runs without Relay per-action approval; client ownership, exact scope, region pinning, bounds and redaction still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [{ id: "events_page", label: "Bounded Cvent events page" }],
};
