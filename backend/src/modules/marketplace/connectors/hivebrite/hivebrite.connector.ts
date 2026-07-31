import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const catalogReads = [
  action(
    "hivebrite_admin_get",
    "Read connected administrator",
    "Read reduced identity and authority metadata for the exactly configured Hivebrite administrator.",
  ),
  action(
    "hivebrite_group_list",
    "List groups",
    "List one bounded page of reduced Group visibility and lifecycle metadata without descriptions, members, experts, partners, locations, images, or configuration.",
  ),
  action(
    "hivebrite_news_category_list",
    "List news categories",
    "List up to twenty-five reduced News Category definitions without posts or content.",
  ),
];
const protectedReads = [
  action(
    "hivebrite_event_list",
    "List events",
    "List one bounded page of reduced Event schedule, registration type, publication, and cancellation metadata without descriptions, locations, contacts, attendees, tickets, or URLs.",
  ),
  action(
    "hivebrite_company_list",
    "List companies",
    "List one bounded page of company IDs and names without contact, address, financial, profile, identifier, or raw data.",
  ),
];
const selected = [...catalogReads, ...protectedReads];
const blockedActions = [
  blocked(
    "hivebrite_content",
    "Read or write content",
    "News, posts, comments, forum discussions, messages, descriptions, media, files, projects, opportunities, mentoring content, and arbitrary rich content are outside V1.",
  ),
  blocked(
    "hivebrite_user_or_membership",
    "Read or manage users and memberships",
    "User directories, profiles, emails, addresses, devices, experiences, education, roles, approvals, group membership, followers, invitations, and user lifecycle actions are outside V1.",
  ),
  blocked(
    "hivebrite_communication",
    "Communicate or notify",
    "Email campaigns, notifications, invitations, messages, posts, comments, and outbound webhooks are outside V1.",
  ),
  blocked(
    "hivebrite_event_or_group_write",
    "Change events or groups",
    "Creating, updating, deleting, duplicating, cancelling, publishing, joining, leaving, or configuring Events, Groups, tickets, bookings, attendees, RSVPs, waitlists, or memberships is outside V1.",
  ),
  blocked(
    "hivebrite_financial",
    "Use financial features",
    "Donations, funds, campaigns, gifts, receipts, payment accounts, bookings, tickets, prices, billing, and financial records are outside V1.",
  ),
  blocked(
    "hivebrite_admin",
    "Administer the network",
    "Settings, attributes, roles, admins, categories, clusters, saved lists, audit logs, imports, exports, integrations, and network configuration are outside V1.",
  ),
  blocked(
    "hivebrite_bulk_or_analytics",
    "Run bulk or analytics actions",
    "Automatic pagination, bulk loops, polling, sync, engagement scoring, analytics, reports, historical reloads, and sustained high-rate access are outside V1.",
  ),
  blocked(
    "hivebrite_private_data",
    "Read broader private data",
    "Emails, phones, addresses, precise locations, custom fields, identifiers, admin comments, revenues, user membership, attendees, registrants, and raw records are outside V1.",
  ),
  blocked(
    "hivebrite_raw_api",
    "Use arbitrary Hivebrite APIs",
    "Arbitrary endpoints, methods, parameters, bodies, headers, alternate origins, raw responses, password or refresh grants, credential exchange, Swagger execution, webhooks, MCP, CLI, and direct database access are outside V1.",
  ),
];

const page = { type: "integer", minimum: 1, maximum: 10_000 };
const maxResults = { type: "integer", minimum: 1, maximum: 25 };
const tool = (
  name: string,
  functionName: string,
  capabilityId: string,
  description: string,
  properties: Record<string, unknown>,
  approvalRequired: boolean,
) => ({
  name,
  functionName,
  aliases: [name, functionName],
  capability: capabilityId,
  platformCapability: `hivebrite_${capabilityId}`,
  action: "read" as const,
  approvalRequired,
  description,
  inputSchema: {
    type: "object",
    properties: {
      ...properties,
      ...(approvalRequired
        ? { approvalId: { type: "string", minLength: 1, maxLength: 200 } }
        : {}),
    },
    required: approvalRequired ? ["approvalId"] : [],
    additionalProperties: false,
  },
});

export const HIVEBRITE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hivebrite",
  name: "Hivebrite",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.hivebrite.com/partner/admin",
  providerWebsiteUrl: "https://hivebrite.io/",
  capabilities: [
    {
      ...capability(
        "community_catalog_read",
        "Read community catalog",
        "Inspect the exact connected administrator plus reduced Group and News Category metadata.",
        true,
      ),
      platformCapability: "hivebrite_community_catalog_read",
    },
    {
      ...capability(
        "event_catalog_read",
        "Read event catalog",
        "Inspect bounded reduced Event schedule and lifecycle metadata without content or participant data.",
        true,
      ),
      platformCapability: "hivebrite_event_catalog_read",
    },
    {
      ...capability(
        "company_catalog_read",
        "Read company catalog",
        "Inspect bounded company IDs and names without contact, address, financial, or profile data.",
        true,
      ),
      platformCapability: "hivebrite_company_catalog_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HIVEBRITE_BASE_URL",
        label: "Hivebrite tenant URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the public HTTPS origin of the exact Hivebrite tenant, without an API path.",
      },
      {
        name: "HIVEBRITE_ADMIN_ID",
        label: "Hivebrite administrator ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact numeric administrator ID represented by the access token. Relay rejects a different administrator.",
      },
      {
        name: "HIVEBRITE_ACCESS_TOKEN",
        label: "Hivebrite Admin API access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Provide a current customer-generated OAuth2 Admin API bearer token. Relay encrypts it and sends it only to the exact tenant.",
      },
    ],
  },
  tools: [
    tool(
      "hivebrite.getCurrentAdmin",
      "hivebrite_admin_get",
      "community_catalog_read",
      "Read reduced identity and authority metadata for the token-owning administrator.",
      {},
      false,
    ),
    tool(
      "hivebrite.listGroups",
      "hivebrite_group_list",
      "community_catalog_read",
      "List one bounded page of reduced Group metadata.",
      { page, maxResults },
      false,
    ),
    tool(
      "hivebrite.listNewsCategories",
      "hivebrite_news_category_list",
      "community_catalog_read",
      "List up to twenty-five reduced News Category definitions.",
      { maxResults },
      false,
    ),
    tool(
      "hivebrite.listEvents",
      "hivebrite_event_list",
      "event_catalog_read",
      "List one bounded page of reduced Event metadata without descriptions, locations, contacts, attendees, tickets, or URLs.",
      { page, maxResults },
      true,
    ),
    tool(
      "hivebrite.listCompanies",
      "hivebrite_company_list",
      "company_catalog_read",
      "List one bounded page of company IDs and names without contact, address, financial, profile, identifier, or raw data.",
      { page, maxResults },
      true,
    ),
  ],
  approvalProfiles: [
    {
      id: "hivebrite_safe",
      label: "Safe",
      description:
        "Connected-administrator, Group, and News Category reads run directly. Event and Company catalog reads require matching approval.",
      defaultSelected: true,
      allowedActions: catalogReads,
      approvalRequiredActions: protectedReads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All five selected bounded Hivebrite V1 reads run without Relay per-action approval; encrypted credentials, exact-tenant/admin binding, provider authority, fixed routes, bounds, audits, privacy reduction, and system blocks still apply.",
      defaultSelected: false,
      allowedActions: selected,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "hivebrite_admin_access_token",
      label:
        "Admin API bearer token authenticates the exactly configured administrator on the exact public HTTPS tenant",
    },
  ],
};
