import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [
  action(
    "moosend_subscriber_summary_get",
    "Read selected subscriber summary",
    "Read only the ID and timestamps for one preselected Moosend subscriber.",
  ),
  action(
    "moosend_campaign_summary_get",
    "Read selected campaign summary",
    "Read bounded lifecycle metadata for one preselected Moosend campaign without statistics.",
  ),
];
const guards = [
  blocked(
    "moosend_private_data",
    "Expose private marketing data",
    "Subscriber identity, email, status, preferences, custom fields, tags, IP, and activity plus campaign name, subject, content, sender, recipients, lists, links, and statistics are excluded.",
  ),
  blocked(
    "moosend_mutation",
    "Mutate Moosend state",
    "Subscribers, lists, segments, campaigns, sends, automation, webhooks, and every other mutation are blocked.",
  ),
  blocked(
    "moosend_broad_access",
    "Use broad Moosend access",
    "Other subscribers, lists, campaigns, segments, reports, arbitrary paths or queries, redirects, downloads, and exports are blocked.",
  ),
];
export const MOOSEND_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "moosend",
  name: "Moosend",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.moosend.com/api-documentation",
  providerWebsiteUrl: "https://moosend.com/",
  capabilities: [
    {
      ...capability(
        "moosend_subscriber_summary_get",
        "Read selected subscriber summary",
        "Read only the ID and timestamps for one selected subscriber.",
        true,
      ),
      platformCapability: "moosend_subscriber_summary_get",
    },
    {
      ...capability(
        "moosend_campaign_summary_get",
        "Read selected campaign summary",
        "Read bounded lifecycle metadata for one selected campaign without statistics.",
        true,
      ),
      platformCapability: "moosend_campaign_summary_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "MOOSEND_API_KEY",
        label: "Moosend API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A customer-generated account API key; Relay encrypts it and sends it only to the fixed api.moosend.com request.",
      },
      {
        name: "MOOSEND_MAILING_LIST_ID",
        label: "Selected mailing list ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText: "The exact list containing the selected subscriber.",
      },
      {
        name: "MOOSEND_SUBSCRIBER_ID",
        label: "Selected subscriber ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact non-email subscriber ID whose ID and timestamps Relay may read.",
      },
      {
        name: "MOOSEND_CAMPAIGN_ID",
        label: "Selected campaign ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact campaign whose bounded non-statistical details Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "moosend.getSubscriberSummary",
      functionName: "moosend_subscriber_summary_get",
      aliases: [
        "moosend.getSubscriberSummary",
        "moosend_subscriber_summary_get",
        "relay_moosend_get_subscriber_summary",
      ],
      capability: "moosend_subscriber_summary_get",
      platformCapability: "moosend_subscriber_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the ID and timestamps for the selected subscriber.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "moosend.getCampaignSummary",
      functionName: "moosend_campaign_summary_get",
      aliases: [
        "moosend.getCampaignSummary",
        "moosend_campaign_summary_get",
        "relay_moosend_get_campaign_summary",
      ],
      capability: "moosend_campaign_summary_get",
      platformCapability: "moosend_campaign_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded lifecycle metadata for the selected campaign without statistics.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "moosend_read_only",
      label: "Read Only",
      description:
        "Read one selected subscriber and campaign through an encrypted account API key; private data, broader access, statistics, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "moosend_no_access",
      label: "No Access",
      description: "Expose no Moosend actions.",
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
      id: "selected_campaign",
      label: "Moosend API key and selected campaign validation",
      requiredScopes: ["account_api_key"],
    },
  ],
};
