import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "mailerlite_subscriber_summary_get",
    "Read selected subscriber summary",
    "Read only the ID and timestamps for one preselected MailerLite subscriber.",
  ),
  action(
    "mailerlite_campaign_summary_get",
    "Read selected campaign summary",
    "Read bounded organizational metadata for one preselected MailerLite campaign.",
  ),
];
const guards = [
  blocked(
    "mailerlite_private_data",
    "Expose private marketing data",
    "Subscriber identity, contact, consent, status, engagement, IP, group, and custom fields plus campaign recipients, content, sender, filters, settings, reports, and raw responses are excluded.",
  ),
  blocked(
    "mailerlite_mutation",
    "Mutate MailerLite state",
    "Subscriber changes, imports, groups, segments, campaigns, sends, automations, forms, webhooks, ecommerce data, and every other mutation are blocked.",
  ),
  blocked(
    "mailerlite_broad_access",
    "Use broad MailerLite access",
    "Other subscribers, campaigns, groups, segments, fields, automations, forms, lists, searches, pages, activities, arbitrary paths, redirects, downloads, and exports are blocked.",
  ),
];

export const MAILERLITE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mailerlite",
  name: "MailerLite",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.mailerlite.com/getting-started",
  providerWebsiteUrl: "https://www.mailerlite.com/",
  capabilities: [
    {
      ...capability(
        "mailerlite_subscriber_summary_get",
        "Read selected subscriber summary",
        "Read only the ID and timestamps for one selected subscriber.",
        true,
      ),
      platformCapability: "mailerlite_subscriber_summary_get",
    },
    {
      ...capability(
        "mailerlite_campaign_summary_get",
        "Read selected campaign summary",
        "Read bounded organizational metadata for one selected campaign.",
        true,
      ),
      platformCapability: "mailerlite_campaign_summary_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "MAILERLITE_API_TOKEN",
        label: "MailerLite API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A customer-generated token from a dedicated least-privilege MailerLite user; Relay encrypts it and sends it only to connect.mailerlite.com.",
      },
      {
        name: "MAILERLITE_SUBSCRIBER_ID",
        label: "Selected numeric subscriber ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The numeric subscriber ID whose ID and timestamps Relay may read; email selectors are rejected.",
      },
      {
        name: "MAILERLITE_CAMPAIGN_ID",
        label: "Selected campaign ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText: "The one campaign whose bounded summary Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "mailerlite.getSubscriberSummary",
      functionName: "mailerlite_subscriber_summary_get",
      aliases: [
        "mailerlite.getSubscriberSummary",
        "mailerlite_subscriber_summary_get",
        "relay_mailerlite_get_subscriber_summary",
      ],
      capability: "mailerlite_subscriber_summary_get",
      platformCapability: "mailerlite_subscriber_summary_get",
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
      name: "mailerlite.getCampaignSummary",
      functionName: "mailerlite_campaign_summary_get",
      aliases: [
        "mailerlite.getCampaignSummary",
        "mailerlite_campaign_summary_get",
        "relay_mailerlite_get_campaign_summary",
      ],
      capability: "mailerlite_campaign_summary_get",
      platformCapability: "mailerlite_campaign_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded organizational metadata for the selected campaign.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "mailerlite_read_only",
      label: "Read Only",
      description:
        "Read one selected subscriber and campaign through an encrypted customer token; private data, broader access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "mailerlite_no_access",
      label: "No Access",
      description: "Expose no MailerLite actions.",
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
      label: "MailerLite token and selected campaign validation",
      requiredScopes: ["account_user_permissions"],
    },
  ],
};
