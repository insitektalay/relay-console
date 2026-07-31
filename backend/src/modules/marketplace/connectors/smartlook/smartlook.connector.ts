import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "smartlook_event_definitions_list",
    "List event definitions",
    "List at most 25 event-definition IDs, names, types, and category IDs from one project.",
  ),
];
const blockedActions = [
  blocked(
    "smartlook_visitor_session_data",
    "Access visitors or sessions",
    "Visitors, identities, sessions, recordings, public links, playback, URLs, devices, locations, and user/session properties are blocked.",
  ),
  blocked(
    "smartlook_event_private_data",
    "Access private event data",
    "Event occurrences, timestamps, selectors, page URLs, text, properties, visitor/session links, and funnel drop-off identities are blocked.",
  ),
  blocked(
    "smartlook_mutation_admin",
    "Mutate or administer Smartlook",
    "Deleting events or visitors, uploading mappings, creating/updating/deleting webhooks, token management, project settings, members, and administration are blocked.",
  ),
  blocked(
    "smartlook_raw_bulk",
    "Use raw or bulk access",
    "Raw paths, arbitrary filters, category filters, cursors, links, pagination, polling, retries, batches, exports, and provider-response pass-through are blocked.",
  ),
];

export const SMARTLOOK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "smartlook",
  name: "Smartlook",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://integrations.smartlook.com/docs/api-overview",
  providerWebsiteUrl: "https://www.smartlook.com/",
  capabilities: [
    {
      ...capability(
        "event_definition_list",
        "List event definitions",
        "List bounded event-definition identity and classification metadata without visitor/session data.",
        true,
      ),
      platformCapability: "smartlook_event_definition_list",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SMARTLOOK_API_TOKEN",
        label: "Smartlook project API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Have the project owner create a dedicated REST API token and store it only through Relay's encrypted connection flow.",
      },
      {
        name: "SMARTLOOK_REGION",
        label: "Smartlook data region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter eu or us to match the project's configured data-storage region.",
      },
    ],
  },
  tools: [
    {
      name: "smartlook.listEventDefinitions",
      functionName: "smartlook_event_definitions_list",
      aliases: [
        "smartlook.listEventDefinitions",
        "smartlook_event_definitions_list",
      ],
      capability: "event_definition_list",
      platformCapability: "smartlook_event_definition_list",
      action: "read",
      approvalRequired: true,
      description:
        "List the first page of strictly projected Smartlook event-definition metadata.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25, default: 25 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "smartlook_event_definitions_safe",
      label: "Safe",
      description:
        "The bounded event-definition read requires approval; visitors, sessions, recordings, private event data, writes, cursors, and raw APIs remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The bounded event-definition read runs without Relay per-action approval; project-token scope, EU/US origin binding, strict projection, result bounds, audits, and no-write behavior remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "event_definition_list_one",
      label: "One-item event-definition read",
    },
  ],
};
