import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
export const OMNISEND_SCOPES = ["contacts.read", "campaigns.read"];
const reads = [
  action(
    "omnisend_contact_summary_get",
    "Read selected contact summary",
    "Read only the ID and timestamps for one preselected Omnisend contact.",
  ),
  action(
    "omnisend_campaign_summary_get",
    "Read selected campaign summary",
    "Read bounded lifecycle metadata for one preselected Omnisend campaign.",
  ),
];
const guards = [
  blocked(
    "omnisend_private_data",
    "Expose private marketing data",
    "Contact identifiers, names, addresses, consent, channels, tags, custom properties, segments, and activity plus campaign name, content, sender, audience, UTM, A/B, booster, and analytics data are excluded.",
  ),
  blocked(
    "omnisend_mutation",
    "Mutate Omnisend state",
    "Contacts, campaigns, content, audiences, sends, schedules, templates, events, segments, products, and every other mutation are blocked.",
  ),
  blocked(
    "omnisend_broad_access",
    "Use broad Omnisend access",
    "Other contacts, campaigns, lists, segments, templates, events, analytics, arbitrary paths, queries, cursors, redirects, downloads, and exports are blocked.",
  ),
];
export const OMNISEND_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "omnisend",
  name: "Omnisend",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api-docs.omnisend.com/reference/getting-started",
  providerWebsiteUrl: "https://www.omnisend.com/",
  capabilities: [
    {
      ...capability(
        "omnisend_contact_summary_get",
        "Read selected contact summary",
        "Read only the ID and timestamps for one selected contact.",
        true,
      ),
      platformCapability: "omnisend_contact_summary_get",
    },
    {
      ...capability(
        "omnisend_campaign_summary_get",
        "Read selected campaign summary",
        "Read bounded lifecycle metadata for one selected campaign.",
        true,
      ),
      platformCapability: "omnisend_campaign_summary_get",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.omnisend.com/oauth2/authorize",
      tokenUrl: "https://app.omnisend.com/oauth2/token",
      requiredScopes: OMNISEND_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "OMNISEND_CLIENT_ID",
        label: "Relay Omnisend OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay OAuth client ID configured with the exact callback and two read scopes.",
      },
      {
        name: "OMNISEND_CLIENT_SECRET",
        label: "Relay Omnisend OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Omnisend client secret; never sent to clients or agents.",
      },
      {
        name: "OMNISEND_CONTACT_ID",
        label: "Selected contact ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact 24-character contact ID whose ID and timestamps Relay may read.",
      },
      {
        name: "OMNISEND_CAMPAIGN_ID",
        label: "Selected campaign ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The exact 24-character campaign ID whose bounded lifecycle metadata Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "omnisend.getContactSummary",
      functionName: "omnisend_contact_summary_get",
      aliases: [
        "omnisend.getContactSummary",
        "omnisend_contact_summary_get",
        "relay_omnisend_get_contact_summary",
      ],
      capability: "omnisend_contact_summary_get",
      platformCapability: "omnisend_contact_summary_get",
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
      name: "omnisend.getCampaignSummary",
      functionName: "omnisend_campaign_summary_get",
      aliases: [
        "omnisend.getCampaignSummary",
        "omnisend_campaign_summary_get",
        "relay_omnisend_get_campaign_summary",
      ],
      capability: "omnisend_campaign_summary_get",
      platformCapability: "omnisend_campaign_summary_get",
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
      id: "omnisend_read_only",
      label: "Read Only",
      description:
        "Read one selected contact and campaign through a two-scope Relay OAuth grant; private data, broader access, analytics, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "omnisend_no_access",
      label: "No Access",
      description: "Expose no Omnisend actions.",
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
        "Omnisend OAuth, version, scopes, and selected campaign validation",
      requiredScopes: OMNISEND_SCOPES,
    },
  ],
};
