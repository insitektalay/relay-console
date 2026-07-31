import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "humanitix_events_list",
    "List events",
    "List at most twenty-five Humanitix event summaries from page one.",
  ),
  action(
    "humanitix_event_get",
    "Read an event",
    "Read one exact Humanitix event metadata summary.",
  ),
];
const blocks = [
  blocked(
    "humanitix_people_and_financial_data",
    "Block people and financial data",
    "Orders, tickets, buyers, attendees, answers, access codes, donations, fees, payments and other sensitive fields are not exposed.",
  ),
  blocked(
    "humanitix_ticketing_actions",
    "Block ticketing actions",
    "Ticket check-in and every other event, order, ticket, tag or account mutation are not exposed.",
  ),
  blocked(
    "humanitix_raw_api",
    "Block raw API access",
    "Arbitrary endpoints, automatic pagination, bulk operations and raw responses are not exposed.",
  ),
];

export const HUMANITIX_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "humanitix",
  name: "Humanitix",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://humanitix.stoplight.io/",
  providerWebsiteUrl: "https://humanitix.com/",
  capabilities: [
    {
      ...capability(
        "event_read",
        "Read event metadata",
        "List bounded Humanitix event summaries and inspect one exact event without people, order or financial data.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HUMANITIX_API_KEY",
        label: "Humanitix public API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate the customer-owned key under Account > Advanced > Public API key and store it encrypted.",
      },
    ],
  },
  tools: [
    {
      name: "relay_humanitix_list_events",
      functionName: "relay_humanitix_list_events",
      aliases: ["humanitix_events_list"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five Humanitix event summaries from page one.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_humanitix_get_event",
      functionName: "relay_humanitix_get_event",
      aliases: ["humanitix_event_get"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact Humanitix event metadata summary.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: { type: "string", pattern: "^[A-Fa-f0-9]{24}$" },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "humanitix_safe",
      label: "Safe",
      description:
        "Bounded event reads run directly; people, financial, ticketing, pagination and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same selected read surface runs without Relay per-action approval; account authority, fixed origin, bounds and redaction still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [{ id: "events_page", label: "Bounded Humanitix events page" }],
};
