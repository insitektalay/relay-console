import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const SALESFORCE_SCOPES = ["api", "refresh_token"];
const reads = [
  action(
    "salesforce_account_list",
    "List accounts",
    "List at most twenty-five bounded business Account summaries.",
  ),
  action(
    "salesforce_opportunity_list",
    "List opportunities",
    "List at most twenty-five bounded Opportunity summaries.",
  ),
  action(
    "salesforce_opportunity_get",
    "Read opportunity",
    "Read one exact Opportunity by Salesforce record ID.",
  ),
];
const blockedActions = [
  blocked(
    "salesforce_mutation",
    "Change Salesforce records",
    "Creating, updating, deleting, converting, merging, or transferring records is outside V1.",
  ),
  blocked(
    "salesforce_personal_records",
    "Read personal records",
    "Contacts, Leads, Users, Cases, activities, email, files, and personal fields are outside V1.",
  ),
  blocked(
    "salesforce_broader_data",
    "Access broader Salesforce data",
    "Custom objects, reports, dashboards, analytics, metadata, setup, and other standard objects are outside V1.",
  ),
  blocked(
    "salesforce_raw_query",
    "Run arbitrary queries",
    "Arbitrary SOQL, SOSL, paths, fields, filters, ordering, pagination, and raw API calls are outside V1.",
  ),
  blocked(
    "salesforce_bulk_or_session",
    "Export or reuse sessions",
    "Bulk, composite, export, frontdoor, and session-reuse access are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const limit = { type: "integer", minimum: 1, maximum: 25 };

export const SALESFORCE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "salesforce",
  name: "Salesforce",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm",
  providerWebsiteUrl: "https://www.salesforce.com/",
  capabilities: [
    {
      ...capability(
        "account_read",
        "Read accounts",
        "List bounded business Account summaries from the exact connected organization.",
        true,
      ),
      platformCapability: "salesforce_account_read",
    },
    {
      ...capability(
        "opportunity_read",
        "Read opportunities",
        "List bounded Opportunity summaries or inspect one exact Opportunity.",
        true,
      ),
      platformCapability: "salesforce_opportunity_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://login.salesforce.com/services/oauth2/authorize",
      tokenUrl: "https://login.salesforce.com/services/oauth2/token",
      refreshUrl: "https://login.salesforce.com/services/oauth2/token",
      requiredScopes: SALESFORCE_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "salesforce.listAccounts",
      functionName: "salesforce_account_list",
      aliases: ["salesforce.listAccounts", "salesforce_account_list"],
      capability: "account_read",
      platformCapability: "salesforce_account_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five bounded business Account summaries.",
      inputSchema: {
        type: "object",
        properties: { limit, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "salesforce.listOpportunities",
      functionName: "salesforce_opportunity_list",
      aliases: ["salesforce.listOpportunities", "salesforce_opportunity_list"],
      capability: "opportunity_read",
      platformCapability: "salesforce_opportunity_read",
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
      name: "salesforce.getOpportunity",
      functionName: "salesforce_opportunity_get",
      aliases: ["salesforce.getOpportunity", "salesforce_opportunity_get"],
      capability: "opportunity_read",
      platformCapability: "salesforce_opportunity_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Opportunity.",
      inputSchema: {
        type: "object",
        properties: {
          opportunityId: {
            type: "string",
            pattern: "^006[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$",
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
      id: "salesforce_safe",
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
        "All three selected read-only tools run without Relay per-action approval while exact-organization and instance binding, provider permissions, static queries, limits, audit, redaction, refresh rotation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "organization",
      label: "Salesforce authorization, organization, and instance validation",
      requiredScopes: SALESFORCE_SCOPES,
    },
  ],
};
