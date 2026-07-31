import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "mailchimp_account_get",
    "Read account metadata",
    "Read the exact account ID, name, authorizing-user role, and member-since time.",
  ),
  action(
    "mailchimp_audience_list",
    "List audience metadata",
    "Read one fixed page of twenty-five audience lifecycle and aggregate-count summaries.",
  ),
  action(
    "mailchimp_campaign_list_recent_sent",
    "List recent sent campaigns",
    "Read one fixed page of twenty-five recently sent campaign lifecycle summaries.",
  ),
];

const blockedActions = [
  blocked(
    "mailchimp_contact_data",
    "Access contact data",
    "Members, subscriber hashes, email addresses, postal addresses, merge fields, GDPR fields, tags, segments, activity, and contact events are outside V1.",
  ),
  blocked(
    "mailchimp_campaign_content",
    "Access campaign content or reports",
    "Subjects, content, recipients, reports, links, click data, and open data are outside V1.",
  ),
  blocked(
    "mailchimp_mutation",
    "Change or send Mailchimp data",
    "Creating, editing, sending, scheduling, pausing, replicating, or deleting Mailchimp resources is outside V1.",
  ),
  blocked(
    "mailchimp_broader_api",
    "Access broader Mailchimp APIs",
    "Automations, commerce, transactional messaging, exports, batches, webhooks, files, templates, and administration are outside V1.",
  ),
  blocked(
    "mailchimp_raw_query",
    "Run arbitrary requests",
    "Arbitrary paths, fields, filters, data centers, pages, automatic pagination, crawling, synchronization, and raw API access are outside V1.",
  ),
];

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const MAILCHIMP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mailchimp",
  name: "Mailchimp",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://mailchimp.com/developer/marketing/api/",
  providerWebsiteUrl: "https://mailchimp.com/",
  capabilities: [
    {
      ...capability(
        "account_metadata",
        "Account metadata",
        "Read exact account and authorizing-user role metadata.",
        true,
      ),
      platformCapability: "mailchimp_account_read",
    },
    {
      ...capability(
        "audience_metadata",
        "Audience metadata",
        "List bounded audience lifecycle and aggregate-count summaries.",
        true,
      ),
      platformCapability: "mailchimp_audience_read",
    },
    {
      ...capability(
        "campaign_metadata",
        "Sent campaign metadata",
        "List bounded recently sent campaign lifecycle summaries.",
        true,
      ),
      platformCapability: "mailchimp_campaign_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://login.mailchimp.com/oauth2/authorize",
      tokenUrl: "https://login.mailchimp.com/oauth2/token",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "mailchimp.getAccount",
      functionName: "mailchimp_account_get",
      aliases: ["mailchimp.getAccount", "mailchimp_account_get"],
      capability: "account_metadata",
      platformCapability: "mailchimp_account_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read the bound Mailchimp account ID, name, authorizing-user role, and member-since time.",
      inputSchema: emptySchema,
    },
    {
      name: "mailchimp.listAudiences",
      functionName: "mailchimp_audience_list",
      aliases: ["mailchimp.listAudiences", "mailchimp_audience_list"],
      capability: "audience_metadata",
      platformCapability: "mailchimp_audience_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty-five audience metadata summaries, newest first.",
      inputSchema: emptySchema,
    },
    {
      name: "mailchimp.listRecentSentCampaigns",
      functionName: "mailchimp_campaign_list_recent_sent",
      aliases: [
        "mailchimp.listRecentSentCampaigns",
        "mailchimp_campaign_list_recent_sent",
      ],
      capability: "campaign_metadata",
      platformCapability: "mailchimp_campaign_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read page one of twenty-five sent campaign lifecycle summaries, newest first.",
      inputSchema: emptySchema,
    },
  ],
  approvalProfiles: [
    {
      id: "mailchimp_safe",
      label: "Safe",
      description:
        "Three bounded metadata-only reads run automatically; contact data, campaign content, broader APIs, raw requests, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same three read-only tools run while exact-account and data-center binding, fixed fields, page limits, audit, redaction, token validation, and provider limits remain enforced.",
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
        "Mailchimp authorization, metadata data center, exact account, and authorizing-user role validation",
      requiredScopes: [],
    },
  ],
};
