import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "bigmarker_conference_inventory_count",
    "Count future conferences",
    "Read one fixed first page and return only aggregate future-conference inventory metadata.",
  ),
];
const blockedActions = [
  blocked(
    "bigmarker_conference_identity_content",
    "Block conference identity and content",
    "Conference, channel, series, meeting-space, presenter, and member IDs plus titles, descriptions, addresses, schedules, branding, tags, and raw records are not returned.",
  ),
  blocked(
    "bigmarker_people_engagement",
    "Block people and engagement",
    "Registrants, attendees, presenters, subscribers, contact details, access links, attendance, polls, questions, chats, surveys, and analytics are not exposed.",
  ),
  blocked(
    "bigmarker_media_access",
    "Block media and privileged access",
    "Recordings, transcripts, downloads, reports, admin URLs, enter URLs, credentials, media, webhooks, and communications are not exposed.",
  ),
  blocked(
    "bigmarker_mutation_raw",
    "Block changes and raw API",
    "Conference, series, registration, presenter, subscriber, poll, block-list, recording, meeting-space, and every other mutation plus arbitrary origins, paths, IDs, filters, pages, bodies, and raw responses are not exposed.",
  ),
];

export const BIGMARKER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "bigmarker",
  name: "BigMarker",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.bigmarker.com/",
  providerWebsiteUrl: "https://www.bigmarker.com",
  capabilities: [
    {
      ...capability(
        "conference_inventory_count",
        "Count future conferences",
        "Inspect only aggregate inventory metadata from one fixed first page of future conferences.",
        true,
      ),
      platformCapability: "bigmarker_conference_inventory_count",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "BIGMARKER_API_KEY",
        label: "BigMarker API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Dedicated BigMarker API key stored only in Railway's encrypted credential store; never use an account password.",
      },
    ],
  },
  tools: [
    {
      name: "bigmarker.countFutureConferences",
      functionName: "bigmarker_conference_inventory_count",
      aliases: [
        "bigmarker.countFutureConferences",
        "bigmarker_conference_inventory_count",
      ],
      capability: "conference_inventory_count",
      platformCapability: "bigmarker_conference_inventory_count",
      action: "read",
      approvalRequired: true,
      description:
        "Read one fixed first page and return only aggregate future-conference inventory metadata.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId: { type: "string", minLength: 1, maxLength: 200 },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "bigmarker_safe",
      label: "Safe",
      description:
        "Every account-wide aggregate future-conference read requires matching Relay approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected aggregate reads run without Relay per-action approval while account binding, fixed origin and endpoint, first-page bounds, record exclusion, audits, encrypted credentials, and BigMarker rate limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "conference_inventory_count",
      label: "BigMarker API-key authorization",
    },
  ],
};
