import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "sendfox_account_get",
    "Read account summary",
    "Read the exact SendFox user ID, contact count, contact limit, and account creation date without returning the user's name or email.",
  ),
  action(
    "sendfox_list_list",
    "List contact-list summaries",
    "List at most twenty-five SendFox contact-list aggregate summaries from the first provider page.",
  ),
  action(
    "sendfox_campaign_list",
    "List campaign lifecycle",
    "List at most twenty-five recent SendFox campaign lifecycle summaries without subject, preview, HTML, sender, recipient, or engagement data.",
  ),
];

export const SENDFOX_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sendfox",
  name: "SendFox",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://sendfox.com/developer/docs/",
  providerWebsiteUrl: "https://sendfox.com/",
  capabilities: [
    {
      ...capability(
        "email_marketing_metadata_read",
        "Read marketing lifecycle metadata",
        "Read bounded account, list aggregate, and campaign lifecycle metadata for one exact paid SendFox account.",
        true,
      ),
      platformCapability: "sendfox_email_marketing_metadata_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://sendfox.com/oauth/authorize",
      tokenUrl: "https://sendfox.com/oauth/token",
      userInfoUrl: "https://api.sendfox.com/me",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "sendfox.getAccountSummary",
      functionName: "sendfox_account_get",
      aliases: ["sendfox.getAccountSummary", "sendfox_account_get"],
      capability: "email_marketing_metadata_read",
      platformCapability: "sendfox_email_marketing_metadata_read",
      action: "read",
      approvalRequired: true,
      description: "Read the redacted exact-account summary.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "sendfox.listContactLists",
      functionName: "sendfox_list_list",
      aliases: ["sendfox.listContactLists", "sendfox_list_list"],
      capability: "email_marketing_metadata_read",
      platformCapability: "sendfox_email_marketing_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five redacted contact-list aggregate summaries.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "sendfox.listCampaigns",
      functionName: "sendfox_campaign_list",
      aliases: ["sendfox.listCampaigns", "sendfox_campaign_list"],
      capability: "email_marketing_metadata_read",
      platformCapability: "sendfox_email_marketing_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five content-free campaign lifecycle summaries.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "sendfox_safe",
      label: "Safe",
      description:
        "Every bounded SendFox metadata read requires approval; contacts, message content, sender and recipient identity, engagement, forms, automations, domains, exports, webhooks, writes, sends, and raw API access remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The three bounded SendFox metadata reads run without Relay per-action approval; exact-account binding, redaction, first-page bounds, audits, and rate limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "account", label: "SendFox exact paid-account OAuth validation" },
  ],
};
