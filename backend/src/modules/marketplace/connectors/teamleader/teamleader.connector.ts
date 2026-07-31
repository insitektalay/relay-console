import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const TEAMLEADER_SCOPES = ["deals"];

const reads = [
  action(
    "teamleader_user_get",
    "Read current user",
    "Read bounded identity metadata for the exact OAuth-bound user.",
  ),
  action(
    "teamleader_deal_list",
    "List deals",
    "List at most twenty-five bounded Deal summaries from fixed page one.",
  ),
  action(
    "teamleader_deal_get",
    "Read deal",
    "Read one exact bounded Deal summary by UUID.",
  ),
];
const blockedActions = [
  blocked(
    "teamleader_record_mutation",
    "Change Teamleader data",
    "Creating, updating, assigning, moving, winning, losing, reopening, duplicating, bulk-changing, or deleting Teamleader records is outside V1.",
  ),
  blocked(
    "teamleader_private_crm",
    "Read private CRM data",
    "Contacts, companies, customers, owners, users beyond the authorizing identity, email addresses, phone numbers, addresses, descriptions, custom fields, notes, activities, files, and relationships are outside V1.",
  ),
  blocked(
    "teamleader_broader_product",
    "Access broader Teamleader data",
    "Deal phases and pipelines, quotations, invoices, products, projects, tasks, time tracking, tickets, calendars, departments, reports, administration, and webhooks are outside V1.",
  ),
  blocked(
    "teamleader_raw_api",
    "Call arbitrary Teamleader APIs",
    "Arbitrary origins, methods, resource actions, filters, sorts, pages, includes, payloads, and raw API access are outside V1.",
  ),
  blocked(
    "teamleader_bulk_export",
    "Export Teamleader data",
    "Automatic pagination, crawling, synchronization, bulk operations, downloads, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const uuid = {
  type: "string",
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
};

export const TEAMLEADER_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "teamleader",
  name: "Teamleader",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.focus.teamleader.eu/docs/authentication",
  providerWebsiteUrl: "https://www.teamleader.eu/",
  capabilities: [
    {
      ...capability(
        "user_read",
        "Read current user",
        "Read bounded identity metadata for the exact OAuth-bound user without returning email or account details.",
        true,
      ),
      platformCapability: "teamleader_user_read",
    },
    {
      ...capability(
        "deal_read",
        "Read deals",
        "List bounded Deal summaries or inspect one exact Deal without customers, owners, people, descriptions, custom fields, activities, files, or relationships.",
        true,
      ),
      platformCapability: "teamleader_deal_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://focus.teamleader.eu/oauth2/authorize",
      tokenUrl: "https://focus.teamleader.eu/oauth2/access_token",
      refreshUrl: "https://focus.teamleader.eu/oauth2/access_token",
      requiredScopes: TEAMLEADER_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "teamleader.getCurrentUser",
      functionName: "teamleader_user_get",
      aliases: ["teamleader.getCurrentUser", "teamleader_user_get"],
      capability: "user_read",
      platformCapability: "teamleader_user_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read bounded identity metadata for the exact OAuth-bound user.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "teamleader.listDeals",
      functionName: "teamleader_deal_list",
      aliases: ["teamleader.listDeals", "teamleader_deal_list"],
      capability: "deal_read",
      platformCapability: "teamleader_deal_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five bounded Deal summaries from fixed page one.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "teamleader.getDeal",
      functionName: "teamleader_deal_get",
      aliases: ["teamleader.getDeal", "teamleader_deal_get"],
      capability: "deal_read",
      platformCapability: "teamleader_deal_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Deal summary.",
      inputSchema: {
        type: "object",
        properties: { dealId: uuid, approvalId },
        required: ["dealId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "teamleader_safe",
      label: "Safe",
      description:
        "All three bounded private CRM reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact OAuth user and resource binding, fixed origin and actions, the deals scope, limits, audits, redaction, serialized refresh rotation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "user",
      label: "Teamleader OAuth user, deals scope, and API validation",
      requiredScopes: TEAMLEADER_SCOPES,
    },
  ],
};
