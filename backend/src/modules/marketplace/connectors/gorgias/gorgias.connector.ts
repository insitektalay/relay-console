import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "gorgias_ticket_list",
    "List ticket metadata",
    "List one fixed first page of content-free Gorgias ticket summaries.",
  ),
  action(
    "gorgias_ticket_get",
    "Read ticket metadata",
    "Read one exact Gorgias ticket through Relay's content-free projection.",
  ),
];
const full = [
  action(
    "gorgias_full_api",
    "Use Gorgias API",
    "Use a documented Gorgias API operation authorized by the API key user's role; Safe mode requires approval.",
  ),
];

export const GORGIAS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "gorgias",
  name: "Gorgias",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.gorgias.com/reference",
  providerWebsiteUrl: "https://www.gorgias.com/",
  capabilities: [
    {
      ...capability(
        "ticket_metadata_read",
        "Read ticket operations",
        "List and inspect bounded ticket operational metadata without subjects, summaries, customers, messages, source addresses, assignees, tags, satisfaction, custom fields, metadata, events, or raw records.",
        true,
      ),
      platformCapability: "gorgias_ticket_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Gorgias API",
        "Use documented tenant-bound API paths and methods allowed by the connected API key user's role.",
        true,
      ),
      platformCapability: "gorgias_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GORGIAS_DOMAIN",
        label: "Gorgias domain",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter the account name before .gorgias.com.",
      },
      {
        name: "GORGIAS_USERNAME",
        label: "Gorgias API username",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the email of a dedicated Gorgias user whose role grants only required operations.",
      },
      {
        name: "GORGIAS_API_KEY",
        label: "Gorgias API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a revocable private-app access token for the dedicated user.",
      },
    ],
  },
  tools: [
    {
      name: "gorgias.listTickets",
      functionName: "gorgias_ticket_list",
      aliases: ["gorgias.listTickets", "gorgias_ticket_list"],
      capability: "ticket_metadata_read",
      platformCapability: "gorgias_ticket_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five newest non-trashed ticket summaries without cursor traversal, content, identities, relationships, or raw pagination cursors.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "gorgias.getTicket",
      functionName: "gorgias_ticket_get",
      aliases: ["gorgias.getTicket", "gorgias_ticket_get"],
      capability: "ticket_metadata_read",
      platformCapability: "gorgias_ticket_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact numeric ticket's ID, lifecycle flags, channel, priority, and timestamps through the same projection.",
      inputSchema: {
        type: "object",
        properties: { ticketId: { type: "integer", minimum: 1 } },
        required: ["ticketId"],
        additionalProperties: false,
      },
    },
    {
      name: "gorgias.request",
      functionName: "gorgias_request",
      aliases: ["gorgias.request", "gorgias_request", "gorgias_full_api"],
      capability: "full_api",
      platformCapability: "gorgias_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented API operation on the connected account's fixed Gorgias origin. Absolute URLs, credentials, redirects, and origin overrides are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          path: {
            type: "string",
            pattern: "^/api/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$",
          },
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
      id: "gorgias_safe",
      label: "Safe",
      description:
        "Content-free ticket reads and every broader API operation require approval; tenant binding, Basic-auth secret isolation, user roles, bounds, and limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...full],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected role-authorized operations run without Relay per-action approval; tenant binding, Basic-auth secret isolation, bounds, audits, roles, and Gorgias limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...full],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "list_tickets",
      label:
        "Gorgias domain, Basic authentication, role, and bounded ticket check",
    },
  ],
};
