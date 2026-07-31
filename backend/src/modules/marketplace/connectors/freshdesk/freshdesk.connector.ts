import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "freshdesk_list_tickets",
    "List tickets",
    "List one bounded page of tickets from the connected Freshdesk account.",
  ),
  action(
    "freshdesk_get_ticket",
    "Read ticket",
    "Read one ticket by its Freshdesk ID.",
  ),
];

const fullApi = [
  action(
    "freshdesk_full_api",
    "Use full Freshdesk API",
    "Use any documented Freshdesk API v2 operation authorized by the connected agent API key; Safe mode requires approval.",
  ),
];

export const FRESHDESK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "freshdesk",
  name: "Freshdesk",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.freshdesk.com/api/",
  providerWebsiteUrl: "https://www.freshworks.com/freshdesk/",
  capabilities: [
    {
      ...capability(
        "ticket_read",
        "Read support tickets",
        "List bounded ticket pages and read individual tickets from the connected Freshdesk account.",
        true,
      ),
      platformCapability: "freshdesk_ticket_read",
    },
    {
      ...capability(
        "full_api",
        "Full Freshdesk API",
        "Use the complete documented Freshdesk API v2 surface allowed by the connected agent's role and API key.",
        true,
      ),
      platformCapability: "freshdesk_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FRESHDESK_DOMAIN",
        label: "Freshdesk domain",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the part before .freshdesk.com in your Freshdesk address.",
      },
      {
        name: "FRESHDESK_API_KEY",
        label: "Freshdesk API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy your own API key from your Freshdesk profile. Its access follows your Freshdesk agent role.",
      },
    ],
  },
  tools: [
    {
      name: "freshdesk.listTickets",
      functionName: "freshdesk_list_tickets",
      aliases: ["freshdesk.listTickets", "freshdesk_list_tickets"],
      capability: "ticket_read",
      platformCapability: "freshdesk_ticket_read",
      action: "read",
      approvalRequired: false,
      description: "List one bounded Freshdesk ticket page.",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "number", minimum: 1, maximum: 10000 },
          perPage: { type: "number", minimum: 1, maximum: 100 },
          updatedSince: { type: "string", format: "date-time" },
          orderBy: {
            type: "string",
            enum: ["created_at", "due_by", "updated_at", "status"],
          },
          orderType: { type: "string", enum: ["asc", "desc"] },
        },
        additionalProperties: false,
      },
    },
    {
      name: "freshdesk.getTicket",
      functionName: "freshdesk_get_ticket",
      aliases: ["freshdesk.getTicket", "freshdesk_get_ticket"],
      capability: "ticket_read",
      platformCapability: "freshdesk_ticket_read",
      action: "read",
      approvalRequired: false,
      description: "Read one Freshdesk ticket by numeric ID.",
      inputSchema: {
        type: "object",
        properties: {
          ticketId: { type: "number", minimum: 1 },
          include: {
            type: "string",
            enum: ["requester", "company", "stats", "description"],
          },
        },
        required: ["ticketId"],
        additionalProperties: false,
      },
    },
    {
      name: "freshdesk.request",
      functionName: "freshdesk_request",
      aliases: ["freshdesk.request", "freshdesk_request", "freshdesk_full_api"],
      capability: "full_api",
      platformCapability: "freshdesk_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Freshdesk API v2 method and path on the connected account's fixed freshdesk.com origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE"],
          },
          path: { type: "string", pattern: "^/api/v2/" },
          query: { type: "object" },
          json: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "freshdesk_safe",
      label: "Safe",
      description:
        "Bounded ticket reads run directly; every other Freshdesk API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected API-key-authorized Freshdesk operation runs without Relay per-action approval; account ownership, exact tenant binding, secret isolation, request bounds, audits, provider roles, and Freshdesk limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "tickets",
      label: "Freshdesk domain, API key, and bounded ticket-list check",
    },
  ],
};
