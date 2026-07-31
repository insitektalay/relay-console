import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const PIPEDRIVE_SCOPES = ["base", "contacts:read", "deals:read"];

const reads = [
  action("pipedrive_organization_list", "List organizations", "List at most twenty-five bounded Organization summaries."),
  action("pipedrive_deal_list", "List deals", "List at most twenty-five bounded Deal summaries."),
  action("pipedrive_deal_get", "Read deal", "Read one exact Deal by positive numeric ID."),
];

const blockedActions = [
  blocked("pipedrive_record_mutation", "Change CRM records", "Creating, updating, merging, archiving, restoring, or deleting Pipedrive records is outside V1."),
  blocked("pipedrive_private_crm", "Read personal CRM data", "Persons, owners, users, email, phone, addresses, activities, notes, files, participants, and followers are outside V1."),
  blocked("pipedrive_broader_crm", "Access broader CRM data", "Products, leads, projects, filters, pipelines, stages, statistics, custom fields, labels, and archived data are outside V1."),
  blocked("pipedrive_raw_search", "Run arbitrary searches", "Arbitrary paths, queries, searches, filters, fields, includes, cursors, domains, and recent-item APIs are outside V1."),
  blocked("pipedrive_bulk_export", "Export Pipedrive data", "Automatic pagination, crawling, synchronization, and broad exports are outside V1."),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const limit = { type: "integer", minimum: 1, maximum: 25 };

export const PIPEDRIVE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "pipedrive",
  name: "Pipedrive",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://pipedrive.readme.io/docs/marketplace-oauth-authorization",
  providerWebsiteUrl: "https://www.pipedrive.com/",
  capabilities: [
    { ...capability("organization_read", "Read organizations", "List bounded Organization summaries from the exact connected Pipedrive company.", true), platformCapability: "pipedrive_organization_read" },
    { ...capability("deal_read", "Read deals", "List bounded Deal summaries or inspect one exact Deal.", true), platformCapability: "pipedrive_deal_read" },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://oauth.pipedrive.com/oauth/authorize",
      tokenUrl: "https://oauth.pipedrive.com/oauth/token",
      refreshUrl: "https://oauth.pipedrive.com/oauth/token",
      requiredScopes: PIPEDRIVE_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    { name: "pipedrive.listOrganizations", functionName: "pipedrive_organization_list", aliases: ["pipedrive.listOrganizations", "pipedrive_organization_list"], capability: "organization_read", platformCapability: "pipedrive_organization_read", action: "read", approvalRequired: true, description: "List at most twenty-five bounded Organization summaries.", inputSchema: { type: "object", properties: { limit, approvalId }, additionalProperties: false } },
    { name: "pipedrive.listDeals", functionName: "pipedrive_deal_list", aliases: ["pipedrive.listDeals", "pipedrive_deal_list"], capability: "deal_read", platformCapability: "pipedrive_deal_read", action: "read", approvalRequired: true, description: "List at most twenty-five bounded Deal summaries.", inputSchema: { type: "object", properties: { limit, approvalId }, additionalProperties: false } },
    { name: "pipedrive.getDeal", functionName: "pipedrive_deal_get", aliases: ["pipedrive.getDeal", "pipedrive_deal_get"], capability: "deal_read", platformCapability: "pipedrive_deal_read", action: "read", approvalRequired: true, description: "Read one exact bounded Deal.", inputSchema: { type: "object", properties: { dealId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" }, approvalId }, required: ["dealId"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "pipedrive_safe", label: "Safe", description: "All three bounded reads require matching approval.", defaultSelected: true, allowedActions: [], approvalRequiredActions: reads, blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "All three selected read-only tools run without Relay per-action approval while exact-company binding, Pipedrive-granted permissions, static requests, limits, audit, redaction, refresh, and provider limits remain enforced.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "company", label: "Pipedrive authorization, company, user, domain, and scope validation", requiredScopes: PIPEDRIVE_SCOPES }],
};
