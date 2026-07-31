import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "airmeet_events_list",
    "List Airmeets",
    "List at most twenty-five Airmeet event summaries from one page.",
  ),
  action(
    "airmeet_sessions_list",
    "List event sessions",
    "List at most twenty-five redacted session summaries for one exact Airmeet.",
  ),
];
const blocks = [
  blocked(
    "airmeet_people_data",
    "Block people data",
    "Participants, attendees, speakers, hosts, polls, questions, booths, direct-access links, recordings, UTM data and engagement analytics are not exposed.",
  ),
  blocked(
    "airmeet_mutations",
    "Block mutations",
    "Airmeet, session, participant, booth and webhook writes are not exposed.",
  ),
  blocked(
    "airmeet_raw_api",
    "Block raw API access",
    "Arbitrary endpoints, datacenter origins, pagination cursors, bulk operations and raw responses are not exposed.",
  ),
];

export const AIRMEET_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "airmeet",
  name: "Airmeet",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.airmeet.com/support/solutions/articles/82000909768-1-event-details-airmeet-public-api",
  providerWebsiteUrl: "https://www.airmeet.com/",
  capabilities: [
    {
      ...capability(
        "event_read",
        "Read event and session metadata",
        "List bounded Airmeet and session summaries without people or engagement data.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "AIRMEET_ACCESS_KEY",
        label: "Airmeet access key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate the customer-owned key pair under API Access Key in the Airmeet community Integrations tab.",
      },
      {
        name: "AIRMEET_SECRET_KEY",
        label: "Airmeet secret key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Store the paired secret encrypted; Relay exchanges the pair only at the selected Airmeet region's fixed /auth endpoint.",
      },
      {
        name: "AIRMEET_REGION",
        label: "Airmeet data region",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Choose default, EU, or US to pin requests to the documented origin matching the Airmeet community.",
      },
    ],
  },
  tools: [
    {
      name: "relay_airmeet_list_events",
      functionName: "relay_airmeet_list_events",
      aliases: ["airmeet_events_list"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five accessible Airmeets without following cursors.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_airmeet_list_sessions",
      functionName: "relay_airmeet_list_sessions",
      aliases: ["airmeet_sessions_list"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five redacted sessions for one exact Airmeet.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            pattern: "^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$",
          },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "airmeet_safe",
      label: "Safe",
      description:
        "Bounded event and session metadata reads run directly; people, engagement, recordings, writes, bulk and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same complete selected read surface runs without Relay per-action approval; key ownership, region pinning, bounds, redaction and provider authority still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [{ id: "airmeets_page", label: "Bounded Airmeets page" }],
};
