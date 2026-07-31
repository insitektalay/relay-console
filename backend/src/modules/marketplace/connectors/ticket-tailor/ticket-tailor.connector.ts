import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "ticket_tailor_events_list",
    "List events",
    "List at most twenty-five Ticket Tailor event summaries from the first cursor page.",
  ),
  action(
    "ticket_tailor_event_get",
    "Read an event",
    "Read one exact Ticket Tailor event metadata summary.",
  ),
];
const blocks = [
  blocked(
    "ticket_tailor_people_and_financial_data",
    "Block people and financial data",
    "Orders, buyers, issued tickets, memberships, waitlists, check-ins, barcodes, payments, reports and personal data are not exposed.",
  ),
  blocked(
    "ticket_tailor_mutations",
    "Block ticketing mutations",
    "Event, series, ticket, order, discount, voucher, product, membership, hold, waitlist and check-in writes are not exposed.",
  ),
  blocked(
    "ticket_tailor_raw_api",
    "Block raw API access",
    "Arbitrary REST or MCP tools, cursor traversal, bulk operations and raw responses are not exposed.",
  ),
];

export const TICKET_TAILOR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ticket-tailor",
  name: "Ticket Tailor",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.tickettailor.com/docs/api/ticket-tailor-api/",
  providerWebsiteUrl: "https://www.tickettailor.com/",
  capabilities: [
    {
      ...capability(
        "event_read",
        "Read event metadata",
        "List bounded Ticket Tailor event summaries and inspect one exact event without people, orders or financial data.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TICKET_TAILOR_API_KEY",
        label: "Ticket Tailor API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a customer-owned key with only the events endpoints selected and keep Hide personal data enabled.",
      },
    ],
  },
  tools: [
    {
      name: "relay_ticket_tailor_list_events",
      functionName: "relay_ticket_tailor_list_events",
      aliases: ["ticket_tailor_events_list"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five Ticket Tailor event summaries from the first cursor page.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_ticket_tailor_get_event",
      functionName: "relay_ticket_tailor_get_event",
      aliases: ["ticket_tailor_event_get"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact Ticket Tailor event metadata summary.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            pattern: "^ev_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$",
          },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "ticket_tailor_safe",
      label: "Safe",
      description:
        "Bounded event reads run directly; people, financial, ticketing writes, cursor traversal and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same selected read surface runs without Relay per-action approval; key scope, fixed origin, bounds and redaction still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "events_page", label: "Bounded Ticket Tailor events page" },
  ],
};
