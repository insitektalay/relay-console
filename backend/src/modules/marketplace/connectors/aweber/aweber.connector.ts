import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const AWEBER_SCOPES = [
  "account.read",
  "list.read",
  "subscriber.read",
  "email.read",
];
const reads = [
  action(
    "aweber_subscriber_summary_get",
    "Read selected subscriber summary",
    "Read only the ID and subscription time for one preselected AWeber subscriber.",
  ),
  action(
    "aweber_campaign_summary_get",
    "Read selected campaign summary",
    "Read bounded organizational metadata for one preselected AWeber broadcast or followup campaign.",
  ),
];
const guards = [
  blocked(
    "aweber_private_data",
    "Expose private marketing data",
    "Subscriber identity, contact, consent, status, activity, IP, location, tags, and custom fields plus campaign subject, content, sender, recipients, links, and statistics are excluded.",
  ),
  blocked(
    "aweber_mutation",
    "Mutate AWeber state",
    "Subscriber changes, tags, custom fields, lists, broadcasts, followups, sends, webhooks, integrations, and every other mutation are blocked.",
  ),
  blocked(
    "aweber_broad_access",
    "Use broad AWeber access",
    "Other accounts, lists, subscribers, campaigns, messages, collections, searches, pages, arbitrary paths, redirects, downloads, and exports are blocked.",
  ),
];

export const AWEBER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "aweber",
  name: "AWeber",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.aweber.com/",
  providerWebsiteUrl: "https://www.aweber.com/",
  capabilities: [
    {
      ...capability(
        "aweber_subscriber_summary_get",
        "Read selected subscriber summary",
        "Read only the ID and subscription time for one selected subscriber.",
        true,
      ),
      platformCapability: "aweber_subscriber_summary_get",
    },
    {
      ...capability(
        "aweber_campaign_summary_get",
        "Read selected campaign summary",
        "Read bounded organizational metadata for one selected broadcast or followup campaign.",
        true,
      ),
      platformCapability: "aweber_campaign_summary_get",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.aweber.com/oauth2/authorize",
      tokenUrl: "https://auth.aweber.com/oauth2/token",
      refreshUrl: "https://auth.aweber.com/oauth2/token",
      requiredScopes: AWEBER_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "AWEBER_CLIENT_ID",
        label: "Relay AWeber OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay confidential-app client ID configured with the exact callback.",
      },
      {
        name: "AWEBER_CLIENT_SECRET",
        label: "Relay AWeber OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held AWeber client secret; never sent to clients or agents.",
      },
      {
        name: "AWEBER_ACCOUNT_ID",
        label: "Selected AWeber account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText: "The numeric account used in both fixed API paths.",
      },
      {
        name: "AWEBER_LIST_ID",
        label: "Selected AWeber list ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText: "The numeric list used in both fixed API paths.",
      },
      {
        name: "AWEBER_SUBSCRIBER_ID",
        label: "Selected numeric subscriber ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The numeric subscriber ID whose ID and subscription time Relay may read.",
      },
      {
        name: "AWEBER_CAMPAIGN_TYPE",
        label: "Selected campaign type",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The documented b broadcast or f followup discriminator for the selected campaign.",
      },
      {
        name: "AWEBER_CAMPAIGN_ID",
        label: "Selected campaign ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The numeric broadcast or followup campaign whose bounded summary Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "aweber.getSubscriberSummary",
      functionName: "aweber_subscriber_summary_get",
      aliases: [
        "aweber.getSubscriberSummary",
        "aweber_subscriber_summary_get",
        "relay_aweber_get_subscriber_summary",
      ],
      capability: "aweber_subscriber_summary_get",
      platformCapability: "aweber_subscriber_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the ID and subscription time for the selected subscriber.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "aweber.getCampaignSummary",
      functionName: "aweber_campaign_summary_get",
      aliases: [
        "aweber.getCampaignSummary",
        "aweber_campaign_summary_get",
        "relay_aweber_get_campaign_summary",
      ],
      capability: "aweber_campaign_summary_get",
      platformCapability: "aweber_campaign_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded organizational metadata for the selected broadcast or followup campaign.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "aweber_read_only",
      label: "Read Only",
      description:
        "Read one selected subscriber and campaign through an account-and-list-bound Relay OAuth grant; private data, broader access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "aweber_no_access",
      label: "No Access",
      description: "Expose no AWeber actions.",
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
      label: "AWeber OAuth, account, list, and selected campaign validation",
      requiredScopes: AWEBER_SCOPES,
    },
  ],
};
