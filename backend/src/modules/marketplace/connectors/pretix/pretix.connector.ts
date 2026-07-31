import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "pretix_events_list",
    "List events",
    "List at most twenty-five event summaries from the first page of one pretix Hosted organizer.",
  ),
  action(
    "pretix_event_get",
    "Read an event",
    "Read one exact pretix event metadata summary.",
  ),
];
const blocks = [
  blocked(
    "pretix_people_and_financial_data",
    "Block people and financial data",
    "Orders, attendees, invoices, payments, check-ins, answers, vouchers and other people or financial records are not exposed.",
  ),
  blocked(
    "pretix_mutations",
    "Block mutations",
    "Event, order, ticket, check-in, settings and every other mutation are not exposed.",
  ),
  blocked(
    "pretix_raw_and_self_hosted",
    "Block raw and arbitrary-host access",
    "Raw responses, arbitrary endpoints, automatic pagination and self-hosted origins are not exposed in this fixed-origin slice.",
  ),
];

export const PRETIX_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "pretix",
  name: "pretix",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.pretix.eu/dev/api/",
  providerWebsiteUrl: "https://pretix.eu/",
  capabilities: [
    {
      ...capability(
        "event_read",
        "Read event metadata",
        "Read bounded event summaries for one pretix Hosted organizer without order, attendee or financial data.",
        true,
      ),
      platformCapability: "event_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "PRETIX_API_TOKEN",
        label: "pretix team API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated team-level token with only event-read authority and store it encrypted.",
      },
      {
        name: "PRETIX_ORGANIZER",
        label: "pretix organizer slug",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The exact pretix Hosted organizer slug this connection may read.",
      },
    ],
  },
  tools: [
    {
      name: "relay_pretix_list_events",
      functionName: "relay_pretix_list_events",
      aliases: ["pretix_events_list"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five event summaries from page one.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "relay_pretix_get_event",
      functionName: "relay_pretix_get_event",
      aliases: ["pretix_event_get"],
      capability: "event_read",
      platformCapability: "event_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact event metadata summary.",
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
      id: "pretix_safe",
      label: "Safe",
      description:
        "Only bounded event metadata reads for the configured organizer run directly.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same two selected reads run without Relay per-action approval; token authority, organizer boundary, fixed origin and redaction remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [{ id: "events_page", label: "Bounded pretix events page" }],
};
