import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ELOQUA_SCOPES = ["full"];
const reads = [
  action(
    "eloqua_contact_summary_get",
    "Read selected contact summary",
    "Read only the ID and timestamps for one preselected Eloqua contact.",
  ),
  action(
    "eloqua_campaign_summary_get",
    "Read selected campaign summary",
    "Read bounded organizational metadata for one preselected Eloqua campaign.",
  ),
];
const guards = [
  blocked(
    "eloqua_private_data",
    "Expose private marketing data",
    "Contact identity, address, preference, activity, account, custom, scoring, and field values plus campaign descriptions, costs, users, elements, fields, and raw responses are excluded.",
  ),
  blocked(
    "eloqua_mutation",
    "Mutate Eloqua state",
    "Contact changes, campaigns, sends, forms, emails, assets, imports, exports, administration, and every other mutation are blocked.",
  ),
  blocked(
    "eloqua_broad_access",
    "Use broad Eloqua access",
    "Other sites, contacts, campaigns, pods, assets, lists, searches, pages, depths, Bulk API, arbitrary paths, redirects, downloads, and exports are blocked despite Eloqua's non-granular full OAuth scope.",
  ),
];

export const ELOQUA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "eloqua",
  name: "Eloqua",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.oracle.com/en/cloud/saas/marketing/eloqua-rest-api/Authentication.html",
  providerWebsiteUrl:
    "https://www.oracle.com/cx/marketing/automation/eloqua-marketing-automation/",
  capabilities: [
    {
      ...capability(
        "eloqua_contact_summary_get",
        "Read selected contact summary",
        "Read only the ID and timestamps for one selected contact.",
        true,
      ),
      platformCapability: "eloqua_contact_summary_get",
    },
    {
      ...capability(
        "eloqua_campaign_summary_get",
        "Read selected campaign summary",
        "Read bounded organizational metadata for one selected campaign.",
        true,
      ),
      platformCapability: "eloqua_campaign_summary_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "ELOQUA_SITE_NAME",
        label: "Eloqua site name",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact Eloqua site/company name; Relay verifies it against the authenticated /id response before using the discovered pod.",
      },
      {
        name: "ELOQUA_CLIENT_ID",
        label: "Eloqua AppCloud app client ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "A customer-owned AppCloud app configured with Relay's exact callback URL.",
      },
      {
        name: "ELOQUA_CLIENT_SECRET",
        label: "Eloqua AppCloud app client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay encrypts this customer secret and sends it only to login.eloqua.com.",
      },
      {
        name: "ELOQUA_REFRESH_TOKEN",
        label: "Eloqua OAuth refresh token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A customer-owned app refresh grant for a dedicated least-privilege Eloqua user.",
      },
      {
        name: "ELOQUA_CONTACT_ID",
        label: "Selected contact ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText: "The one contact whose ID and timestamps Relay may read.",
      },
      {
        name: "ELOQUA_CAMPAIGN_ID",
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
      name: "eloqua.getContactSummary",
      functionName: "eloqua_contact_summary_get",
      aliases: [
        "eloqua.getContactSummary",
        "eloqua_contact_summary_get",
        "relay_eloqua_get_contact_summary",
      ],
      capability: "eloqua_contact_summary_get",
      platformCapability: "eloqua_contact_summary_get",
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
      name: "eloqua.getCampaignSummary",
      functionName: "eloqua_campaign_summary_get",
      aliases: [
        "eloqua.getCampaignSummary",
        "eloqua_campaign_summary_get",
        "relay_eloqua_get_campaign_summary",
      ],
      capability: "eloqua_campaign_summary_get",
      platformCapability: "eloqua_campaign_summary_get",
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
      id: "eloqua_read_only",
      label: "Read Only",
      description:
        "Read one selected contact and campaign through a site-bound customer OAuth grant; private data, broader access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "eloqua_no_access",
      label: "No Access",
      description: "Expose no Eloqua actions.",
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
      label:
        "Eloqua OAuth, site, discovered pod, and selected campaign validation",
      requiredScopes: ELOQUA_SCOPES,
    },
  ],
};
