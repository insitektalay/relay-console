import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const DRIP_SCOPES = ["public"];
const reads = [
  action(
    "drip_subscriber_summary_get",
    "Read selected subscriber summary",
    "Read only the ID and timestamps for one preselected Drip subscriber.",
  ),
  action(
    "drip_campaign_summary_get",
    "Read selected Email Series Campaign summary",
    "Read bounded organizational metadata for one preselected Drip Email Series Campaign.",
  ),
];
const guards = [
  blocked(
    "drip_private_data",
    "Expose private marketing data",
    "Subscriber identity, contact, consent, status, activity, score, value, tags, custom, purchase, and IP fields plus campaign sender, notification, subscriber, form, and link data are excluded.",
  ),
  blocked(
    "drip_mutation",
    "Mutate Drip state",
    "Subscriber changes, subscriptions, tags, events, campaigns, workflows, forms, webhooks, shopper activity, sends, and every other mutation are blocked.",
  ),
  blocked(
    "drip_broad_access",
    "Use broad Drip access",
    "Other accounts, subscribers, campaigns, users, lists, searches, pages, workflows, conversions, events, arbitrary paths, redirects, downloads, and exports are blocked.",
  ),
];

export const DRIP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "drip",
  name: "Drip",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.drip.com/",
  providerWebsiteUrl: "https://www.drip.com/",
  capabilities: [
    {
      ...capability(
        "drip_subscriber_summary_get",
        "Read selected subscriber summary",
        "Read only the ID and timestamps for one selected subscriber.",
        true,
      ),
      platformCapability: "drip_subscriber_summary_get",
    },
    {
      ...capability(
        "drip_campaign_summary_get",
        "Read selected Email Series Campaign summary",
        "Read bounded organizational metadata for one selected Email Series Campaign.",
        true,
      ),
      platformCapability: "drip_campaign_summary_get",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://www.getdrip.com/oauth/authorize",
      tokenUrl: "https://www.getdrip.com/oauth/token",
      userInfoUrl: "https://api.getdrip.com/v2/user",
      requiredScopes: DRIP_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "DRIP_CLIENT_ID",
        label: "Relay Drip OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay public-integration client ID configured with the exact callback.",
      },
      {
        name: "DRIP_CLIENT_SECRET",
        label: "Relay Drip OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Drip client secret; never sent to clients or agents.",
      },
      {
        name: "DRIP_ACCOUNT_ID",
        label: "Selected Drip account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText: "The one account used in both fixed API paths.",
      },
      {
        name: "DRIP_SUBSCRIBER_ID",
        label: "Selected non-email subscriber ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The opaque subscriber ID whose ID and timestamps Relay may read; email selectors are rejected.",
      },
      {
        name: "DRIP_CAMPAIGN_ID",
        label: "Selected Email Series Campaign ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "The one Email Series Campaign whose bounded summary Relay may read.",
      },
    ],
  },
  tools: [
    {
      name: "drip.getSubscriberSummary",
      functionName: "drip_subscriber_summary_get",
      aliases: [
        "drip.getSubscriberSummary",
        "drip_subscriber_summary_get",
        "relay_drip_get_subscriber_summary",
      ],
      capability: "drip_subscriber_summary_get",
      platformCapability: "drip_subscriber_summary_get",
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
      name: "drip.getCampaignSummary",
      functionName: "drip_campaign_summary_get",
      aliases: [
        "drip.getCampaignSummary",
        "drip_campaign_summary_get",
        "relay_drip_get_campaign_summary",
      ],
      capability: "drip_campaign_summary_get",
      platformCapability: "drip_campaign_summary_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded organizational metadata for the selected Email Series Campaign.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "drip_read_only",
      label: "Read Only",
      description:
        "Read one selected subscriber and Email Series Campaign through an account-bound Relay OAuth grant; private data, broader access, and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "drip_no_access",
      label: "No Access",
      description: "Expose no Drip actions.",
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
      label: "Drip OAuth, account, and selected campaign validation",
      requiredScopes: DRIP_SCOPES,
    },
  ],
};
