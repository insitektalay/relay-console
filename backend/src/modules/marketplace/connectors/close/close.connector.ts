import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const CLOSE_SCOPES = ["all.full_access", "offline_access"];

const reads = [
  action(
    "close_organization_get",
    "Read organization",
    "Read bounded metadata for the exact token-bound Close organization.",
  ),
  action(
    "close_opportunity_list",
    "List opportunities",
    "List at most twenty-five bounded Opportunity summaries.",
  ),
  action(
    "close_opportunity_get",
    "Read opportunity",
    "Read one exact Opportunity by oppo_ ID.",
  ),
];

const blockedActions = [
  blocked(
    "close_record_mutation",
    "Change CRM records",
    "Creating, updating, bulk-changing, merging, or deleting Close records is outside V1.",
  ),
  blocked(
    "close_private_crm",
    "Read private CRM data",
    "Leads, contacts, phone numbers, email addresses, communications, activities, notes, files, and custom fields are outside V1.",
  ),
  blocked(
    "close_broader_crm",
    "Access broader Close data",
    "Users beyond the authorizing user, tasks, sequences, workflows, inboxes, reporting, integrations, and administration are outside V1.",
  ),
  blocked(
    "close_raw_search",
    "Run arbitrary searches",
    "Arbitrary paths, filters, search queries, fields, grouping, pages, and raw API access are outside V1.",
  ),
  blocked(
    "close_bulk_export",
    "Export Close data",
    "Automatic pagination, crawling, synchronization, bulk APIs, and exports are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const limit = { type: "integer", minimum: 1, maximum: 25 };

export const CLOSE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "close",
  name: "Close",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.close.com/api/overview/oauth-authentication",
  providerWebsiteUrl: "https://www.close.com/",
  capabilities: [
    {
      ...capability(
        "organization_read",
        "Read organization",
        "Read bounded metadata for the exact connected Close organization.",
        true,
      ),
      platformCapability: "close_organization_read",
    },
    {
      ...capability(
        "opportunity_read",
        "Read opportunities",
        "List bounded Opportunity summaries or inspect one exact Opportunity.",
        true,
      ),
      platformCapability: "close_opportunity_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.close.com/oauth2/authorize/",
      tokenUrl: "https://api.close.com/oauth2/token/",
      requiredScopes: CLOSE_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
      revocationUrl: "https://api.close.com/oauth2/revoke/",
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "close.getOrganization",
      functionName: "close_organization_get",
      aliases: ["close.getOrganization", "close_organization_get"],
      capability: "organization_read",
      platformCapability: "close_organization_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read bounded metadata for the exact connected Close organization.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "close.listOpportunities",
      functionName: "close_opportunity_list",
      aliases: ["close.listOpportunities", "close_opportunity_list"],
      capability: "opportunity_read",
      platformCapability: "close_opportunity_read",
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
      name: "close.getOpportunity",
      functionName: "close_opportunity_get",
      aliases: ["close.getOpportunity", "close_opportunity_get"],
      capability: "opportunity_read",
      platformCapability: "close_opportunity_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Opportunity.",
      inputSchema: {
        type: "object",
        properties: {
          opportunityId: {
            type: "string",
            pattern: "^oppo_[A-Za-z0-9]{1,200}$",
          },
          approvalId,
        },
        required: ["opportunityId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "close_safe",
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
        "All three selected read-only tools run without Relay per-action approval while exact-organization binding, Close-granted authority, static requests, limits, audit, redaction, refresh rotation, revocation, and provider limits remain enforced.",
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
        "Close authorization, organization, authorizing user, scope, and rotating-refresh validation",
      requiredScopes: CLOSE_SCOPES,
    },
  ],
};
