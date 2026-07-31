import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "goldcast_events_list",
    "List events",
    "List at most twenty-five events from the connected Goldcast organization.",
  ),
  action(
    "goldcast_event_get",
    "Read an event",
    "Read one exact Goldcast event metadata summary.",
  ),
];
const blocks = [
  blocked(
    "goldcast_people_data",
    "Block people data",
    "Registrants, attendees, speakers, engagement, leads, email addresses, magic links, analytics exports and custom registration fields are not exposed.",
  ),
  blocked(
    "goldcast_mutations",
    "Block event mutations",
    "Event, agenda, booth, broadcast, member, resource, registration and webhook writes are not exposed.",
  ),
  blocked(
    "goldcast_raw_api",
    "Block raw API access",
    "Arbitrary endpoints, automatic pagination, bulk operations and raw provider responses are not exposed.",
  ),
];

export const GOLDCAST_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "goldcast",
  name: "Goldcast",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.goldcast.io/en_US/general-integrations/22931655725723-how-to-create-an-api-token-in-goldcast",
  providerWebsiteUrl: "https://www.goldcast.io/",
  capabilities: [
    {
      ...capability(
        "event_read",
        "Read event metadata",
        "List bounded event summaries and inspect one exact event without people or engagement data.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GOLDCAST_API_TOKEN",
        label: "Goldcast API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a customer-owned token in Goldcast Studio. API tokens require an eligible plan and may need Goldcast Support to enable them.",
      },
    ],
  },
  tools: [
    {
      name: "relay_goldcast_list_events",
      functionName: "relay_goldcast_list_events",
      aliases: ["goldcast_events_list"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five Goldcast event metadata summaries from one provider page.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_goldcast_get_event",
      functionName: "relay_goldcast_get_event",
      aliases: ["goldcast_event_get"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact Goldcast event metadata summary.",
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
      id: "goldcast_safe",
      label: "Safe",
      description:
        "Two bounded event-metadata reads run directly; people data, engagement, writes, bulk access and raw API access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same selected read surface runs without Relay per-action approval; credential ownership, fixed origin, bounds, redaction and provider limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [{ id: "events_page", label: "Bounded Goldcast events page" }],
};
