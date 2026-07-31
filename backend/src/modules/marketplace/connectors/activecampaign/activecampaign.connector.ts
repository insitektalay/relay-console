import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "activecampaign_account_binding_get",
    "Read account binding",
    "Validate the exact API origin and token-bound user ID without returning user identity fields.",
  ),
  action(
    "activecampaign_list_list_recent",
    "List recent lists",
    "Read one fixed page of twenty-five List lifecycle summaries.",
  ),
  action(
    "activecampaign_campaign_list_recent",
    "List recent campaigns",
    "Read one fixed page of twenty-five Campaign lifecycle summaries.",
  ),
];

const blockedActions = [
  blocked(
    "activecampaign_contact_private",
    "Access contacts or identity",
    "Contacts, email addresses, phone numbers, user identity fields, custom fields, tags, scores, consent, and contact activity are outside V1.",
  ),
  blocked(
    "activecampaign_campaign_content",
    "Access campaign content or reports",
    "Campaign names, messages, content, audiences, recipients, links, opens, clicks, replies, bounces, and reports are outside V1.",
  ),
  blocked(
    "activecampaign_mutation",
    "Change or send ActiveCampaign data",
    "Creating, editing, importing, sending, scheduling, automating, or deleting ActiveCampaign resources is outside V1.",
  ),
  blocked(
    "activecampaign_broader_api",
    "Access broader ActiveCampaign APIs",
    "Deals, automations, events, ecommerce, forms, messages, webhooks, administration, and custom objects are outside V1.",
  ),
  blocked(
    "activecampaign_raw_query",
    "Run arbitrary requests",
    "Arbitrary origins, paths, filters, orders, pages, limits, automatic pagination, crawling, synchronization, exports, and raw API access are outside V1.",
  ),
];

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const ACTIVECAMPAIGN_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "activecampaign",
  name: "ActiveCampaign",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.activecampaign.com/reference/overview",
  providerWebsiteUrl: "https://www.activecampaign.com/",
  capabilities: [
    {
      ...capability(
        "account_binding",
        "Account binding",
        "Validate the exact account origin and token-bound user.",
        true,
      ),
      platformCapability: "activecampaign_account_read",
    },
    {
      ...capability(
        "list_metadata",
        "List metadata",
        "List bounded List lifecycle summaries.",
        true,
      ),
      platformCapability: "activecampaign_list_read",
    },
    {
      ...capability(
        "campaign_metadata",
        "Campaign metadata",
        "List bounded Campaign lifecycle summaries.",
        true,
      ),
      platformCapability: "activecampaign_campaign_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ACTIVECAMPAIGN_API_URL",
        label: "ActiveCampaign API URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the exact HTTPS API URL from Settings > Developer; Relay accepts only an official account-specific api-us1.com origin.",
      },
      {
        name: "ACTIVECAMPAIGN_API_TOKEN",
        label: "ActiveCampaign API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the current user's unique API key from Settings > Developer. Rotating it invalidates this connection.",
      },
    ],
  },
  tools: [
    {
      name: "activecampaign.getAccountBinding",
      functionName: "activecampaign_account_binding_get",
      aliases: [
        "activecampaign.getAccountBinding",
        "activecampaign_account_binding_get",
      ],
      capability: "account_binding",
      platformCapability: "activecampaign_account_read",
      action: "read",
      approvalRequired: false,
      description:
        "Validate the bound official API origin and token-bound user ID without returning identity fields.",
      inputSchema: emptySchema,
    },
    {
      name: "activecampaign.listRecentLists",
      functionName: "activecampaign_list_list_recent",
      aliases: [
        "activecampaign.listRecentLists",
        "activecampaign_list_list_recent",
      ],
      capability: "list_metadata",
      platformCapability: "activecampaign_list_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty-five List lifecycle summaries, newest first.",
      inputSchema: emptySchema,
    },
    {
      name: "activecampaign.listRecentCampaigns",
      functionName: "activecampaign_campaign_list_recent",
      aliases: [
        "activecampaign.listRecentCampaigns",
        "activecampaign_campaign_list_recent",
      ],
      capability: "campaign_metadata",
      platformCapability: "activecampaign_campaign_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty-five Campaign lifecycle summaries, newest send date first.",
      inputSchema: emptySchema,
    },
  ],
  approvalProfiles: [
    {
      id: "activecampaign_safe",
      label: "Safe",
      description:
        "Three bounded metadata-only reads run automatically; identity, contacts, content, reports, broader APIs, raw requests, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact-origin and token-user binding, fixed requests, page limits, audit, redaction, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "current_user",
      label:
        "ActiveCampaign official account origin and exact token-bound current-user validation",
    },
  ],
};
