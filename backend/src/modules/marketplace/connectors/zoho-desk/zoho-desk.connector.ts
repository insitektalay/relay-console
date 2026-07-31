import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const ZOHO_DESK_SCOPES = ["Desk.tickets.READ", "Desk.basic.READ"];

const reads = [
  action(
    "zoho_desk_ticket_list",
    "List tickets",
    "List at most twenty-five recently modified privacy-redacted ticket summaries from the consent-bound Zoho Desk organization.",
  ),
  action(
    "zoho_desk_ticket_get",
    "Read ticket",
    "Read one exact privacy-redacted Zoho Desk ticket summary by positive numeric ID.",
  ),
];

const blockedActions = [
  blocked(
    "zoho_desk_ticket_mutation",
    "Change tickets",
    "Creating, updating, assigning, moving, merging, commenting on, closing, restoring, or deleting tickets is outside V1.",
  ),
  blocked(
    "zoho_desk_private_support_data",
    "Read private support content",
    "Contacts, accounts, agents, email, phone, descriptions, threads, comments, attachments, tasks, time entries, followers, tags, and custom fields are outside V1.",
  ),
  blocked(
    "zoho_desk_broader_support",
    "Access broader support data",
    "Departments, products, teams, contracts, calls, events, knowledge-base articles, community, layouts, settings, analytics, and administration are outside V1.",
  ),
  blocked(
    "zoho_desk_raw_search",
    "Run arbitrary searches or API calls",
    "Other products, organizations, regions, scopes, endpoints, methods, fields, includes, filters, searches, query parameters, versions, and raw requests are outside V1.",
  ),
  blocked(
    "zoho_desk_bulk_export",
    "Export support data",
    "Automatic pagination, deep offsets, synchronization, notifications, bulk APIs, downloads, imports, and exports are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const limit = { type: "integer", minimum: 1, maximum: 25 };

export const ZOHO_DESK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zoho-desk",
  name: "Zoho Desk",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://desk.zoho.com/DeskAPIDocument",
  providerWebsiteUrl: "https://www.zoho.com/desk/",
  capabilities: [
    {
      ...capability(
        "ticket_read",
        "Read tickets",
        "List bounded privacy-redacted ticket summaries or inspect one exact ticket in the consent-bound Zoho Desk organization.",
        true,
      ),
      platformCapability: "zoho_desk_ticket_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
      tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
      refreshUrl: "https://accounts.zoho.com/oauth/v2/token",
      revocationUrl: "https://accounts.zoho.com/oauth/v2/token/revoke",
      requiredScopes: ZOHO_DESK_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "zohoDesk.listTickets",
      functionName: "zoho_desk_ticket_list",
      aliases: ["zohoDesk.listTickets", "zoho_desk_ticket_list"],
      capability: "ticket_read",
      platformCapability: "zoho_desk_ticket_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five recently modified privacy-redacted Zoho Desk ticket summaries.",
      inputSchema: {
        type: "object",
        properties: { limit, approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "zohoDesk.getTicket",
      functionName: "zoho_desk_ticket_get",
      aliases: ["zohoDesk.getTicket", "zoho_desk_ticket_get"],
      capability: "ticket_read",
      platformCapability: "zoho_desk_ticket_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact privacy-redacted Zoho Desk ticket summary.",
      inputSchema: {
        type: "object",
        properties: {
          ticketId: { type: "string", pattern: "^[1-9][0-9]{0,24}$" },
          approvalId,
        },
        required: ["ticketId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "zoho_desk_safe",
      label: "Safe",
      description: "Both bounded private ticket reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both selected read-only tools run without Relay per-action approval while exact organization, regional origin, scopes, static requests, limits, audit, redaction, refresh, revocation, and provider limits remain enforced.",
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
        "Zoho Desk authorization, consent-bound organization, region, ticket/basic scopes, refresh, and bounded read validation",
      requiredScopes: ZOHO_DESK_SCOPES,
    },
  ],
};
