import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
const reads = [
  action(
    "mailercloud_contact_summary_get",
    "Read selected contact summary",
    "Read only the ID and timestamps for one preselected Mailercloud contact.",
  ),
  action(
    "mailercloud_campaign_summary_get",
    "Read selected campaign summary",
    "Read bounded lifecycle metadata for one preselected Mailercloud campaign.",
  ),
];
const guards = [
  blocked(
    "mailercloud_private_data",
    "Expose private marketing data",
    "Contact identity, email, phone, status, consent, fields, tags, lists, and activity plus campaign name, subject, content, sender, audience, reports, and links are excluded.",
  ),
  blocked(
    "mailercloud_mutation",
    "Mutate Mailercloud state",
    "Contacts, lists, tags, campaigns, sends, templates, automation, and every other mutation are blocked.",
  ),
  blocked(
    "mailercloud_broad_access",
    "Use broad Mailercloud access",
    "Other contacts, campaigns, lists, tags, reports, arbitrary paths, queries, redirects, downloads, and exports are blocked.",
  ),
];
export const MAILERCLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mailercloud",
  name: "Mailercloud",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://apidoc.mailercloud.com/",
  providerWebsiteUrl: "https://www.mailercloud.com/",
  capabilities: [
    {
      ...capability(
        "mailercloud_contact_summary_get",
        "Read selected contact summary",
        "Read only the ID and timestamps for one selected contact.",
        true,
      ),
      platformCapability: "mailercloud_contact_summary_get",
    },
    {
      ...capability(
        "mailercloud_campaign_summary_get",
        "Read selected campaign summary",
        "Read bounded lifecycle metadata for one selected campaign.",
        true,
      ),
      platformCapability: "mailercloud_campaign_summary_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "MAILERCLOUD_API_KEY",
        label: "Mailercloud API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A dedicated customer-generated API key; Relay encrypts it and sends it only in the Authorization header to cloudapi.mailercloud.com.",
      },
      {
        name: "MAILERCLOUD_CONTACT_ID",
        label: "Selected non-email contact ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact contact ID whose ID and timestamps Relay may read; email selectors are rejected.",
      },
      {
        name: "MAILERCLOUD_CAMPAIGN_ID",
        label: "Selected campaign ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact campaign whose bounded lifecycle metadata Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "mailercloud.getContactSummary",
      functionName: "mailercloud_contact_summary_get",
      aliases: [
        "mailercloud.getContactSummary",
        "mailercloud_contact_summary_get",
        "relay_mailercloud_get_contact_summary",
      ],
      capability: "mailercloud_contact_summary_get",
      platformCapability: "mailercloud_contact_summary_get",
      action: "read",
      approvalRequired: false,
      description: "Read only the ID and timestamps for the selected contact.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "mailercloud.getCampaignSummary",
      functionName: "mailercloud_campaign_summary_get",
      aliases: [
        "mailercloud.getCampaignSummary",
        "mailercloud_campaign_summary_get",
        "relay_mailercloud_get_campaign_summary",
      ],
      capability: "mailercloud_campaign_summary_get",
      platformCapability: "mailercloud_campaign_summary_get",
      action: "read",
      approvalRequired: false,
      description: "Read bounded lifecycle metadata for the selected campaign.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "mailercloud_read_only",
      label: "Read Only",
      description:
        "Read one selected contact and campaign through an encrypted dedicated API key; private data, broader access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "mailercloud_no_access",
      label: "No Access",
      description: "Expose no Mailercloud actions.",
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
      label: "Mailercloud API key and selected campaign validation",
      requiredScopes: ["account_api_key"],
    },
  ],
};
