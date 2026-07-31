import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "demio_event_inventory_count",
    "Count event inventory",
    "Read the fixed Demio event list and return only aggregate inventory counts.",
  ),
];

const blockedActions = [
  blocked(
    "demio_event_identity_content",
    "Block event identity and content",
    "Event and session IDs, names, descriptions, dates, registration and room links, presenters, custom fields, branding, and raw records are not returned.",
  ),
  blocked(
    "demio_people_engagement",
    "Block people and engagement",
    "Registrants, attendees, contact details, join links, attendance, chat, polls, handouts, questions, responses, and analytics are not exposed.",
  ),
  blocked(
    "demio_media_communications",
    "Block media and communications",
    "Recordings, replay links, transcripts, slides, videos, emails, reminders, integrations, webhooks, and communications are not exposed.",
  ),
  blocked(
    "demio_mutation_raw",
    "Block changes and raw API",
    "Registration, event and session changes, automation, integrations, and every other mutation plus arbitrary paths, IDs, filters, pages, origins, bodies, headers, credentials, and raw responses are not exposed.",
  ),
];

export const DEMIO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "demio",
  name: "Demio",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://publicdemioapi.docs.apiary.io/",
  providerWebsiteUrl: "https://www.demio.com",
  capabilities: [
    {
      ...capability(
        "event_inventory_count",
        "Count event inventory",
        "Inspect only aggregate counts from the fixed Demio event inventory endpoint.",
        true,
      ),
      platformCapability: "demio_event_inventory_count",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "DEMIO_API_KEY",
        label: "Demio API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Owner-generated Demio account API key stored only in Railway's encrypted credential store.",
      },
      {
        name: "DEMIO_API_SECRET",
        label: "Demio API secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Owner-generated Demio account API secret stored only in Railway's encrypted credential store.",
      },
    ],
  },
  tools: [
    {
      name: "demio.countEventInventory",
      functionName: "demio_event_inventory_count",
      aliases: ["demio.countEventInventory", "demio_event_inventory_count"],
      capability: "event_inventory_count",
      platformCapability: "demio_event_inventory_count",
      action: "read",
      approvalRequired: true,
      description:
        "Read the fixed Demio event list and return only aggregate inventory counts.",
      inputSchema: {
        type: "object",
        properties: {
          approvalId: { type: "string", minLength: 1, maxLength: 200 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "demio_safe",
      label: "Safe",
      description:
        "Every account-wide aggregate event inventory read requires matching Relay approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected aggregate reads run without Relay per-action approval while account binding, the fixed origin and endpoint, response cap, content exclusion, audits, encrypted credentials, and Demio quotas remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "event_inventory_count",
      label: "Demio account API authorization",
    },
  ],
};
