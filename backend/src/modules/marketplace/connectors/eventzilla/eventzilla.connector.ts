import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "eventzilla_events_list",
    "List events",
    "List at most twenty-five Eventzilla event summaries from offset zero.",
  ),
  action(
    "eventzilla_event_get",
    "Read an event",
    "Read one exact Eventzilla event metadata summary.",
  ),
];
const blocks = [
  blocked(
    "eventzilla_people_and_financial_data",
    "Block people and financial data",
    "Attendees, buyers, orders, transactions, questions, answers, barcodes, promo codes and payment details are not exposed.",
  ),
  blocked(
    "eventzilla_mutations",
    "Block event and registration mutations",
    "Publishing, checkout, registration, order confirmation, attendee check-in and other writes are not exposed.",
  ),
  blocked(
    "eventzilla_raw_api",
    "Block raw API access",
    "Arbitrary endpoints, automatic pagination, bulk operations and raw responses are not exposed.",
  ),
];

export const EVENTZILLA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "eventzilla",
  name: "Eventzilla",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.eventzilla.net/docs/",
  providerWebsiteUrl: "https://www.eventzilla.net/",
  capabilities: [
    {
      ...capability(
        "event_read",
        "Read event metadata",
        "List bounded Eventzilla event summaries and inspect one exact event without people, orders or financial data.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "EVENTZILLA_API_KEY",
        label: "Eventzilla API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a customer-owned application key under Eventzilla Settings > App Management and store it encrypted.",
      },
    ],
  },
  tools: [
    {
      name: "relay_eventzilla_list_events",
      functionName: "relay_eventzilla_list_events",
      aliases: ["eventzilla_events_list"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five Eventzilla event summaries from offset zero.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_eventzilla_get_event",
      functionName: "relay_eventzilla_get_event",
      aliases: ["eventzilla_event_get"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact Eventzilla event metadata summary.",
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
      id: "eventzilla_safe",
      label: "Safe",
      description:
        "Bounded event reads run directly; people, financial, registration, write, bulk and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same selected read surface runs without Relay per-action approval; credential ownership, fixed origin, bounds and redaction still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    { id: "events_page", label: "Bounded Eventzilla events page" },
  ],
};
