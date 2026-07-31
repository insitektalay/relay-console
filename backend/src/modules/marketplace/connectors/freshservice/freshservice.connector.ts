import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const ticketReads = [
  action(
    "freshservice_ticket_list",
    "List service tickets",
    "List one fixed first page of bounded Freshservice ticket summaries.",
  ),
  action(
    "freshservice_ticket_get",
    "Read service ticket",
    "Read one exact Freshservice ticket through Relay's bounded projection.",
  ),
];
const fullApi = [
  action(
    "freshservice_full_api",
    "Use full Freshservice API",
    "Use a documented Freshservice API v2 operation authorized by the connected agent API key; Safe mode requires approval.",
  ),
];

export const FRESHSERVICE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "freshservice",
  name: "Freshservice",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.freshservice.com/v2/",
  providerWebsiteUrl: "https://www.freshworks.com/freshservice/",
  capabilities: [
    {
      ...capability(
        "ticket_read",
        "Read service tickets",
        "List bounded ticket summaries and read one exact ticket without requester contacts, conversations, attachments, custom fields, descriptions, or embedded resources.",
        true,
      ),
      platformCapability: "freshservice_ticket_read",
    },
    {
      ...capability(
        "full_api",
        "Full Freshservice API",
        "Use the documented Freshservice API v2 surface allowed by the connected agent role and personal API key.",
        true,
      ),
      platformCapability: "freshservice_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FRESHSERVICE_DOMAIN",
        label: "Freshservice domain",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the account name before .freshservice.com; custom CNAMEs are not supported by API v2.",
      },
      {
        name: "FRESHSERVICE_API_KEY",
        label: "Freshservice API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy your personal API key from Freshservice profile settings. Its access follows your Freshservice agent role.",
      },
    ],
  },
  tools: [
    {
      name: "freshservice.listTickets",
      functionName: "freshservice_ticket_list",
      aliases: ["freshservice.listTickets", "freshservice_ticket_list"],
      capability: "ticket_read",
      platformCapability: "freshservice_ticket_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five ticket operational summaries from page one without embeds, requester contacts, descriptions, conversations, attachments, or custom fields.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          workspaceId: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "freshservice.getTicket",
      functionName: "freshservice_ticket_get",
      aliases: ["freshservice.getTicket", "freshservice_ticket_get"],
      capability: "ticket_read",
      platformCapability: "freshservice_ticket_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact numeric ticket through the same bounded operational projection without embeds.",
      inputSchema: {
        type: "object",
        properties: { ticketId: { type: "integer", minimum: 1 } },
        required: ["ticketId"],
        additionalProperties: false,
      },
    },
    {
      name: "freshservice.request",
      functionName: "freshservice_request",
      aliases: [
        "freshservice.request",
        "freshservice_request",
        "freshservice_full_api",
      ],
      capability: "full_api",
      platformCapability: "freshservice_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Freshservice API v2 method and relative path on the fixed account origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
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
      id: "freshservice_safe",
      label: "Safe",
      description:
        "Bounded ticket reads and every broader API operation require approval; tenant binding, secret isolation, provider roles, and limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...ticketReads, ...fullApi],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected API-key-authorized operations run without Relay per-action approval; exact tenant binding, secret isolation, request bounds, audits, provider roles, and Freshservice limits still apply.",
      defaultSelected: false,
      allowedActions: [...ticketReads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "tickets",
      label:
        "Freshservice domain, API key, role, and bounded ticket-list check",
    },
  ],
};
