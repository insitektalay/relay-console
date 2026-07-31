import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const CONSTANT_CONTACT_SCOPES = [
  "account_read",
  "campaign_data",
  "offline_access",
];
export const CONSTANT_CONTACT_PRIVILEGES = [
  "account:read",
  "campaign:read",
  "ui:campaign:metrics",
];

const reads = [
  action(
    "constant_contact_account_get",
    "Read Account metadata",
    "Read the exact encoded Account ID and organization name.",
  ),
  action(
    "constant_contact_campaign_list_recent",
    "List recent Email Campaigns",
    "Read the first twenty-five Campaign lifecycle summaries.",
  ),
  action(
    "constant_contact_campaign_summary_list_recent",
    "List recent Campaign Summary Reports",
    "Read the first twenty-five aggregate Campaign performance summaries.",
  ),
];
const blockedActions = [
  blocked(
    "constant_contact_contact_private",
    "Access contacts or person-level tracking",
    "Contacts, lists, segments, identity, consent, and person-level reporting are outside V1.",
  ),
  blocked(
    "constant_contact_campaign_content",
    "Access Campaign content or identity",
    "Campaign names, subjects, content, activities, senders, recipients, permalinks, and audience details are outside V1.",
  ),
  blocked(
    "constant_contact_broader_api",
    "Access broader Constant Contact APIs",
    "SMS, events, social, landing pages, contacts, segments, and administration are outside V1.",
  ),
  blocked(
    "constant_contact_marketing_mutation",
    "Change or send Constant Contact data",
    "Creating, updating, sending, administering, importing, or deleting provider resources is outside V1.",
  ),
  blocked(
    "constant_contact_raw_query",
    "Run arbitrary requests",
    "Arbitrary dates, pages, cursors, filters, paths, pagination, crawling, exports, and raw API access are outside V1.",
  ),
];
const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const CONSTANT_CONTACT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "constant-contact",
    name: "Constant Contact",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.constantcontact.com/api_guide/index.html",
    providerWebsiteUrl: "https://www.constantcontact.com/",
    capabilities: [
      {
        ...capability(
          "account_metadata",
          "Account metadata",
          "Read the exact Constant Contact Account summary.",
          true,
        ),
        platformCapability: "constant_contact_account_read",
      },
      {
        ...capability(
          "campaign_metadata",
          "Email Campaign metadata",
          "List bounded recent Email Campaign lifecycle summaries.",
          true,
        ),
        platformCapability: "constant_contact_campaign_read",
      },
      {
        ...capability(
          "campaign_summary",
          "Campaign aggregate reports",
          "List bounded aggregate Email Campaign Summary Reports.",
          true,
        ),
        platformCapability: "constant_contact_report_read",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl:
          "https://authz.constantcontact.com/oauth2/default/v1/authorize",
        tokenUrl: "https://authz.constantcontact.com/oauth2/default/v1/token",
        refreshUrl: "https://authz.constantcontact.com/oauth2/default/v1/token",
        requiredScopes: CONSTANT_CONTACT_SCOPES,
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [],
    },
    tools: [
      {
        name: "constant-contact.getAccount",
        functionName: "constant_contact_account_get",
        aliases: [
          "constant-contact.getAccount",
          "constant_contact_account_get",
        ],
        capability: "account_metadata",
        platformCapability: "constant_contact_account_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read only the exact encoded Account ID and organization name.",
        inputSchema: emptySchema,
      },
      {
        name: "constant-contact.listRecentCampaigns",
        functionName: "constant_contact_campaign_list_recent",
        aliases: [
          "constant-contact.listRecentCampaigns",
          "constant_contact_campaign_list_recent",
        ],
        capability: "campaign_metadata",
        platformCapability: "constant_contact_campaign_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read the first twenty-five content-free Email Campaign lifecycle summaries.",
        inputSchema: emptySchema,
      },
      {
        name: "constant-contact.listRecentCampaignSummaries",
        functionName: "constant_contact_campaign_summary_list_recent",
        aliases: [
          "constant-contact.listRecentCampaignSummaries",
          "constant_contact_campaign_summary_list_recent",
        ],
        capability: "campaign_summary",
        platformCapability: "constant_contact_report_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read the first twenty-five aggregate Email Campaign Summary Reports without contact drilldowns.",
        inputSchema: emptySchema,
      },
    ],
    approvalProfiles: [
      {
        id: "constant_contact_safe",
        label: "Safe",
        description:
          "Three bounded metadata and aggregate-report reads run automatically; contacts, person-level tracking, content, broader APIs, raw requests, exports, and writes stay blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same three read-only tools run while exact-Account, exact scopes, required privileges, fixed fields, page limits, audit, redaction, and token rotation remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "account",
        label:
          "Constant Contact OAuth, exact Account, exact scopes, reporting privileges, and rotating token-pair validation",
        requiredScopes: CONSTANT_CONTACT_SCOPES,
      },
    ],
  };
