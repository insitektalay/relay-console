import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ZOHO_SCOPES = [
  "ZohoCRM.modules.accounts.READ",
  "ZohoCRM.modules.deals.READ",
  "ZohoCRM.org.READ",
  "ZohoCRM.users.READ",
];

const reads = [
  action(
    "zoho_account_list",
    "List accounts",
    "List at most twenty-five bounded Zoho CRM Account summaries.",
  ),
  action(
    "zoho_deal_list",
    "List deals",
    "List at most twenty-five bounded Zoho CRM Deal summaries.",
  ),
  action(
    "zoho_deal_get",
    "Read deal",
    "Read one exact Zoho CRM Deal by positive numeric ID.",
  ),
];

const blockedActions = [
  blocked(
    "zoho_record_mutation",
    "Change CRM records",
    "Creating, updating, converting, merging, sharing, archiving, restoring, or deleting Zoho CRM records is outside V1.",
  ),
  blocked(
    "zoho_private_crm",
    "Read personal CRM data",
    "Leads, Contacts, users other than the connected user, email, phone, addresses, activities, notes, files, participants, and followers are outside V1.",
  ),
  blocked(
    "zoho_broader_crm",
    "Access broader CRM data",
    "Campaigns, cases, products, quotes, orders, invoices, forecasts, territories, metadata, custom modules, and related lists are outside V1.",
  ),
  blocked(
    "zoho_raw_query",
    "Run arbitrary searches or queries",
    "Arbitrary modules, paths, fields, queries, searches, COQL, GraphQL, custom views, filters, and raw API access are outside V1.",
  ),
  blocked(
    "zoho_bulk_export",
    "Export CRM data",
    "Automatic pagination, bulk APIs, synchronization, notifications, and broad exports are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const limit = { type: "integer", minimum: 1, maximum: 25 };

export const ZOHO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoho",
  name: "Zoho CRM",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.zoho.com/crm/developer/docs/api/v8/",
  providerWebsiteUrl: "https://www.zoho.com/crm/",
  capabilities: [
    {
      ...capability(
        "account_read",
        "Read accounts",
        "List bounded Account summaries from the exact connected Zoho CRM organization.",
        true,
      ),
      platformCapability: "zoho_account_read",
    },
    {
      ...capability(
        "deal_read",
        "Read deals",
        "List bounded Deal summaries or inspect one exact Deal.",
        true,
      ),
      platformCapability: "zoho_deal_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      refreshUrl: "https://accounts.zoho.com/oauth/v2/token",
      revocationUrl: "https://accounts.zoho.com/oauth/v2/token/revoke",
      requiredScopes: ZOHO_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "zoho.listAccounts",
      functionName: "zoho_account_list",
      aliases: ["zoho.listAccounts", "zoho_account_list"],
      capability: "account_read",
      platformCapability: "zoho_account_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five bounded Zoho CRM Account summaries.",
      inputSchema: {
        type: "object",
        properties: { limit, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "zoho.listDeals",
      functionName: "zoho_deal_list",
      aliases: ["zoho.listDeals", "zoho_deal_list"],
      capability: "deal_read",
      platformCapability: "zoho_deal_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty-five bounded Zoho CRM Deal summaries.",
      inputSchema: {
        type: "object",
        properties: { limit, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "zoho.getDeal",
      functionName: "zoho_deal_get",
      aliases: ["zoho.getDeal", "zoho_deal_get"],
      capability: "deal_read",
      platformCapability: "zoho_deal_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Zoho CRM Deal.",
      inputSchema: {
        type: "object",
        properties: {
          dealId: { type: "string", pattern: "^[1-9][0-9]{0,24}$" },
          approvalId,
        },
        required: ["dealId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoho_safe",
      label: "Safe",
      description: "All three bounded reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact-organization binding, Zoho-granted permissions, regional origins, static requests, limits, audit, redaction, refresh, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "organization",
      label:
        "Zoho CRM authorization, organization, user, region, and scope validation",
      requiredScopes: ZOHO_SCOPES,
    },
  ],
};
