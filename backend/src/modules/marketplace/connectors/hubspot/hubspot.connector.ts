import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const HUBSPOT_SCOPES = [
  "oauth",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
];
const reads = [
  action(
    "hubspot_company_list",
    "List companies",
    "List at most twenty-five bounded Company summaries.",
  ),
  action(
    "hubspot_deal_list",
    "List deals",
    "List at most twenty-five bounded Deal summaries.",
  ),
  action(
    "hubspot_deal_get",
    "Read deal",
    "Read one exact Deal by HubSpot record ID.",
  ),
];
const blockedActions = [
  blocked(
    "hubspot_record_mutation",
    "Change CRM records",
    "Creating, updating, associating, archiving, restoring, or deleting HubSpot records is outside V1.",
  ),
  blocked(
    "hubspot_private_crm",
    "Read personal CRM data",
    "Contacts, owners, users, emails, calls, meetings, notes, tickets, and payments are outside V1.",
  ),
  blocked(
    "hubspot_broader_crm",
    "Access broader HubSpot data",
    "Custom objects or properties, associations, history, products, quotes, line items, webhooks, and extensions are outside V1.",
  ),
  blocked(
    "hubspot_raw_search",
    "Run arbitrary searches",
    "Arbitrary objects, filters, queries, properties, associations, cursors, archive flags, and paths are outside V1.",
  ),
  blocked(
    "hubspot_bulk_export",
    "Export HubSpot data",
    "Automatic pagination, crawling, synchronization, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const limit = { type: "integer", minimum: 1, maximum: 25 };

export const HUBSPOT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hubspot",
  name: "HubSpot",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/working-with-oauth",
  providerWebsiteUrl: "https://www.hubspot.com/",
  capabilities: [
    {
      ...capability(
        "company_read",
        "Read companies",
        "List bounded Company summaries from the exact connected HubSpot account.",
        true,
      ),
      platformCapability: "hubspot_company_read",
    },
    {
      ...capability(
        "deal_read",
        "Read deals",
        "List bounded Deal summaries or inspect one exact Deal.",
        true,
      ),
      platformCapability: "hubspot_deal_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.hubspot.com/oauth/authorize",
      tokenUrl: "https://api.hubapi.com/oauth/2026-03/token",
      refreshUrl: "https://api.hubapi.com/oauth/2026-03/token",
      requiredScopes: HUBSPOT_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "hubspot.listCompanies",
      functionName: "hubspot_company_list",
      aliases: ["hubspot.listCompanies", "hubspot_company_list"],
      capability: "company_read",
      platformCapability: "hubspot_company_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty-five bounded Company summaries.",
      inputSchema: {
        type: "object",
        properties: { limit, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "hubspot.listDeals",
      functionName: "hubspot_deal_list",
      aliases: ["hubspot.listDeals", "hubspot_deal_list"],
      capability: "deal_read",
      platformCapability: "hubspot_deal_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty-five bounded Deal summaries.",
      inputSchema: {
        type: "object",
        properties: { limit, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "hubspot.getDeal",
      functionName: "hubspot_deal_get",
      aliases: ["hubspot.getDeal", "hubspot_deal_get"],
      capability: "deal_read",
      platformCapability: "hubspot_deal_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Deal.",
      inputSchema: {
        type: "object",
        properties: {
          dealId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
          approvalId,
        },
        required: ["dealId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "hubspot_safe",
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
        "All three selected read-only tools run without Relay per-action approval while exact-account binding, provider permissions, static requests, limits, audit, redaction, refresh, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "account",
      label: "HubSpot authorization, Hub, user, and scope validation",
      requiredScopes: HUBSPOT_SCOPES,
    },
  ],
};
