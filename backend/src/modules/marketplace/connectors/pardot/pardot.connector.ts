import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const PARDOT_SCOPES = ["pardot_api", "refresh_token"];
const reads = [
  action(
    "pardot_prospect_summary_get",
    "Read selected prospect summary",
    "Read only the ID and timestamps for one preselected Account Engagement prospect.",
  ),
  action(
    "pardot_campaign_summary_get",
    "Read selected campaign summary",
    "Read bounded organizational metadata for one preselected Account Engagement campaign.",
  ),
];
const guards = [
  blocked(
    "pardot_private_data",
    "Expose private marketing data",
    "Prospect contact, preference, score, activity, custom, assignment, and CRM fields plus campaign cost, folders, users, raw responses, and tokens are excluded.",
  ),
  blocked(
    "pardot_mutation",
    "Mutate Account Engagement state",
    "Prospect changes, campaigns, tags, sends, assets, imports, exports, administration, and every other mutation are blocked.",
  ),
  blocked(
    "pardot_broad_access",
    "Use broad Account Engagement access",
    "Other environments, business units, prospects, campaigns, objects, lists, searches, pages, versions, bulk APIs, arbitrary paths, redirects, downloads, and exports are blocked.",
  ),
];

export const PARDOT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "pardot",
  name: "Pardot",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.salesforce.com/docs/marketing/pardot/guide/authentication.html",
  providerWebsiteUrl: "https://www.salesforce.com/marketing/b2b-automation/",
  capabilities: [
    {
      ...capability(
        "pardot_prospect_summary_get",
        "Read selected prospect summary",
        "Read only the ID and timestamps for one selected prospect.",
        true,
      ),
      platformCapability: "pardot_prospect_summary_get",
    },
    {
      ...capability(
        "pardot_campaign_summary_get",
        "Read selected campaign summary",
        "Read bounded organizational metadata for one selected campaign.",
        true,
      ),
      platformCapability: "pardot_campaign_summary_get",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "PARDOT_ENVIRONMENT",
        label: "Account Engagement environment",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Exactly production, sandbox, or developer; Relay pins the matching Salesforce token and Account Engagement API origins.",
      },
      {
        name: "PARDOT_CLIENT_ID",
        label: "Salesforce external client app ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "A customer-owned external client app configured only for Account Engagement API and offline refresh access.",
      },
      {
        name: "PARDOT_CLIENT_SECRET",
        label: "Salesforce external client app secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay encrypts this customer secret and sends it only to the selected Salesforce token origin.",
      },
      {
        name: "PARDOT_REFRESH_TOKEN",
        label: "Salesforce OAuth refresh token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "A refresh token issued to an SSO-enabled Account Engagement user for the customer-owned app.",
      },
      {
        name: "PARDOT_BUSINESS_UNIT_ID",
        label: "Account Engagement business unit ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact 18-character 0Uv business unit ID sent on every API request.",
      },
      {
        name: "PARDOT_PROSPECT_ID",
        label: "Selected prospect ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText: "The one prospect whose ID and timestamps Relay may read.",
      },
      {
        name: "PARDOT_CAMPAIGN_ID",
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
      name: "pardot.getProspectSummary",
      functionName: "pardot_prospect_summary_get",
      aliases: [
        "pardot.getProspectSummary",
        "pardot_prospect_summary_get",
        "relay_pardot_get_prospect_summary",
      ],
      capability: "pardot_prospect_summary_get",
      platformCapability: "pardot_prospect_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the ID and timestamps for the preselected prospect.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "pardot.getCampaignSummary",
      functionName: "pardot_campaign_summary_get",
      aliases: [
        "pardot.getCampaignSummary",
        "pardot_campaign_summary_get",
        "relay_pardot_get_campaign_summary",
      ],
      capability: "pardot_campaign_summary_get",
      platformCapability: "pardot_campaign_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded organizational metadata for the preselected campaign.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "pardot_read_only",
      label: "Read Only",
      description:
        "Read one selected prospect and campaign through a business-unit-bound customer OAuth grant; private data, broader access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "pardot_no_access",
      label: "No Access",
      description: "Expose no Account Engagement actions.",
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
        "Account Engagement OAuth, environment, business unit, and selected campaign validation",
      requiredScopes: PARDOT_SCOPES,
    },
  ],
};
