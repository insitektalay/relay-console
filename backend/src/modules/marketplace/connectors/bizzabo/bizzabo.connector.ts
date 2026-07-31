import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [
  action(
    "bizzabo_events_list",
    "List events",
    "List at most twenty-five Bizzabo event summaries from page zero.",
  ),
  action(
    "bizzabo_event_get",
    "Read an event",
    "Read one exact Bizzabo event metadata summary.",
  ),
];
const blocks = [
  blocked(
    "bizzabo_people_data",
    "Block people data",
    "Contacts, registrants, attendees, speakers, partners, badges, engagement and analytics are not exposed.",
  ),
  blocked(
    "bizzabo_mutations",
    "Block mutations",
    "Event, agenda, session, registration, attendee and webhook writes are not exposed.",
  ),
  blocked(
    "bizzabo_raw_api",
    "Block raw API access",
    "Arbitrary endpoints, automatic pagination, bulk operations and raw responses are not exposed.",
  ),
];
export const BIZZABO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "bizzabo",
  name: "Bizzabo",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://www.bizzabo.com/event-management-software/event-software-integrations",
  providerWebsiteUrl: "https://www.bizzabo.com/",
  capabilities: [
    {
      ...capability(
        "event_read",
        "Read event metadata",
        "List bounded Bizzabo event summaries and inspect one exact event without people or engagement data.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "BIZZABO_API_KEY",
        label: "Bizzabo API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create the customer-owned API credential in the Bizzabo account API/Integrations area and store it encrypted.",
      },
    ],
  },
  tools: [
    {
      name: "relay_bizzabo_list_events",
      functionName: "relay_bizzabo_list_events",
      aliases: ["bizzabo_events_list"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five Bizzabo event summaries from page zero.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_bizzabo_get_event",
      functionName: "relay_bizzabo_get_event",
      aliases: ["bizzabo_event_get"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact Bizzabo event metadata summary.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$",
          },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "bizzabo_safe",
      label: "Safe",
      description:
        "Bounded event reads run directly; people, engagement, writes, bulk and raw access remain blocked.",
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
  healthChecks: [{ id: "events_page", label: "Bounded Bizzabo events page" }],
};
