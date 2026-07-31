import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "flodesk_subscriber_summary_get",
    "Read selected subscriber summary",
    "Read only the ID and creation timestamp for one preselected Flodesk subscriber.",
  ),
  action(
    "flodesk_segment_summary_get",
    "Read selected segment summary",
    "Read only the ID and creation timestamp for one preselected Flodesk segment.",
  ),
];

const guards = [
  blocked(
    "flodesk_private_data",
    "Expose private marketing data",
    "Subscriber email, name, status, source, segments, custom fields, consent IP/timestamp, and activity plus segment name, active count, and color are excluded.",
  ),
  blocked(
    "flodesk_mutation",
    "Mutate Flodesk state",
    "Subscribers, segments, workflows, custom fields, webhooks, unsubscribes, and every other mutation are blocked.",
  ),
  blocked(
    "flodesk_broad_access",
    "Use broad Flodesk access",
    "Other subscribers, segments, workflows, custom fields, webhooks, arbitrary paths, queries, redirects, downloads, and bulk access are blocked.",
  ),
];

export const FLODESK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "flodesk",
  name: "Flodesk",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.flodesk.com/",
  providerWebsiteUrl: "https://flodesk.com/",
  capabilities: [
    {
      ...capability(
        "flodesk_subscriber_summary_get",
        "Read selected subscriber summary",
        "Read only the ID and creation timestamp for one selected subscriber.",
        true,
      ),
      platformCapability: "flodesk_subscriber_summary_get",
    },
    {
      ...capability(
        "flodesk_segment_summary_get",
        "Read selected segment summary",
        "Read only the ID and creation timestamp for one selected segment.",
        true,
      ),
      platformCapability: "flodesk_segment_summary_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "FLODESK_API_KEY",
        label: "Flodesk API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A dedicated customer-generated full-access key; Relay encrypts it and uses it only as the Basic-auth username with an empty password for api.flodesk.com.",
      },
      {
        name: "FLODESK_SUBSCRIBER_ID",
        label: "Selected non-email subscriber ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact subscriber ID whose ID and creation timestamp Relay may read; email selectors are rejected.",
      },
      {
        name: "FLODESK_SEGMENT_ID",
        label: "Selected segment ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact segment whose ID and creation timestamp Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "flodesk.getSubscriberSummary",
      functionName: "flodesk_subscriber_summary_get",
      aliases: [
        "flodesk.getSubscriberSummary",
        "flodesk_subscriber_summary_get",
        "relay_flodesk_get_subscriber_summary",
      ],
      capability: "flodesk_subscriber_summary_get",
      platformCapability: "flodesk_subscriber_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the ID and creation time for the selected subscriber.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "flodesk.getSegmentSummary",
      functionName: "flodesk_segment_summary_get",
      aliases: [
        "flodesk.getSegmentSummary",
        "flodesk_segment_summary_get",
        "relay_flodesk_get_segment_summary",
      ],
      capability: "flodesk_segment_summary_get",
      platformCapability: "flodesk_segment_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the ID and creation time for the selected segment.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "flodesk_read_only",
      label: "Read Only",
      description:
        "Read one selected subscriber and segment through an encrypted dedicated API key; private data, broader access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "flodesk_no_access",
      label: "No Access",
      description: "Expose no Flodesk actions.",
      defaultSelected: false,
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [
        ...reads.map((item) =>
          blocked(item.id, item.label, "Blocked by authority preset."),
        ),
        ...guards,
      ],
    },
  ],
  healthChecks: [
    {
      id: "selected_segment",
      label: "Flodesk API key and selected segment validation",
      requiredScopes: ["full_account_api_key"],
    },
  ],
};
