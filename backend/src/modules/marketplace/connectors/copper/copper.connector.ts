import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const COPPER_SCOPES = ["developer/v1/all"];

const reads = [
  action(
    "copper_account_get",
    "Read account",
    "Read bounded metadata for the exact token-bound Copper account.",
  ),
  action(
    "copper_opportunity_list",
    "List opportunities",
    "List at most twenty-five bounded Opportunity summaries.",
  ),
  action(
    "copper_opportunity_get",
    "Read opportunity",
    "Read one exact Opportunity by positive numeric ID.",
  ),
];

const blockedActions = [
  blocked(
    "copper_record_mutation",
    "Change CRM records",
    "Creating, updating, converting, relating, bulk-changing, or deleting Copper records is outside V1.",
  ),
  blocked(
    "copper_private_crm",
    "Read personal CRM data",
    "People, Leads, Users other than the authorizing user, contact data, activities, descriptions, custom fields, tags, files, and relationships are outside V1.",
  ),
  blocked(
    "copper_broader_crm",
    "Access broader CRM data",
    "Projects, Tasks, pipelines, sources, loss reasons, field layouts, webhooks, and administration are outside V1.",
  ),
  blocked(
    "copper_raw_search",
    "Run arbitrary searches",
    "Arbitrary paths, bodies, filters, sort fields, pages, API-key headers, and raw API access are outside V1.",
  ),
  blocked(
    "copper_bulk_export",
    "Export Copper data",
    "Automatic pagination, crawling, synchronization, bulk APIs, and broad exports are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const limit = { type: "integer", minimum: 1, maximum: 25 };

export const COPPER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "copper",
  name: "Copper",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.copper.com/introduction/oauth/index.html",
  providerWebsiteUrl: "https://www.copper.com/",
  capabilities: [
    {
      ...capability(
        "account_read",
        "Read account",
        "Read bounded metadata for the exact connected Copper account.",
        true,
      ),
      platformCapability: "copper_account_read",
    },
    {
      ...capability(
        "opportunity_read",
        "Read opportunities",
        "List bounded Opportunity summaries or inspect one exact Opportunity.",
        true,
      ),
      platformCapability: "copper_opportunity_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.copper.com/oauth/authorize",
      tokenUrl: "https://app.copper.com/oauth/token",
      requiredScopes: COPPER_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "copper.getAccount",
      functionName: "copper_account_get",
      aliases: ["copper.getAccount", "copper_account_get"],
      capability: "account_read",
      platformCapability: "copper_account_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read bounded metadata for the exact connected Copper account.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "copper.listOpportunities",
      functionName: "copper_opportunity_list",
      aliases: ["copper.listOpportunities", "copper_opportunity_list"],
      capability: "opportunity_read",
      platformCapability: "copper_opportunity_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty-five bounded Opportunity summaries.",
      inputSchema: {
        type: "object",
        properties: { limit, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "copper.getOpportunity",
      functionName: "copper_opportunity_get",
      aliases: ["copper.getOpportunity", "copper_opportunity_get"],
      capability: "opportunity_read",
      platformCapability: "copper_opportunity_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Opportunity.",
      inputSchema: {
        type: "object",
        properties: {
          opportunityId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
          approvalId,
        },
        required: ["opportunityId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "copper_safe",
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
        "All three selected read-only tools run without Relay per-action approval while exact-account binding, Copper-granted authority, static requests, limits, audit, redaction, token validation, and provider limits remain enforced.",
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
        "Copper authorization, account, authorizing user, and broad-scope validation",
      requiredScopes: COPPER_SCOPES,
    },
  ],
};
