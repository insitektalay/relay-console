import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const ticketReads = [
  action(
    "liveagent_ticket_list",
    "List ticket metadata",
    "List one fixed first page of content-free LiveAgent ticket summaries.",
  ),
  action(
    "liveagent_ticket_get",
    "Read ticket metadata",
    "Read one exact LiveAgent ticket through Relay's content-free operational projection.",
  ),
];
const fullApi = [
  action(
    "liveagent_full_api",
    "Use API v3",
    "Use a documented LiveAgent API v3 operation authorized by the connected API key; Safe mode requires approval.",
  ),
];

export const LIVEAGENT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "liveagent",
  name: "LiveAgent",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://support.liveagent.com/docs/api/v3/",
  providerWebsiteUrl: "https://www.liveagent.com/",
  capabilities: [
    {
      ...capability(
        "ticket_metadata_read",
        "Read ticket operations",
        "List and inspect bounded ticket operational metadata without subjects, messages, notes, contacts, names, email addresses, phone numbers, custom fields, tags, attachments, or raw records.",
        true,
      ),
      platformCapability: "liveagent_ticket_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "LiveAgent API v3",
        "Use documented API v3 paths and methods allowed by the connected LiveAgent API key.",
        true,
      ),
      platformCapability: "liveagent_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "LIVEAGENT_DOMAIN",
        label: "LiveAgent account domain",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact ladesk.com or liveagent.com hostname for your LiveAgent account.",
      },
      {
        name: "LIVEAGENT_API_KEY",
        label: "LiveAgent API v3 key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create an API v3 key with only the ticket read permissions needed for bounded reads; broader operations require corresponding provider permissions.",
      },
    ],
  },
  tools: [
    {
      name: "liveagent.listTickets",
      functionName: "liveagent_ticket_list",
      aliases: ["liveagent.listTickets", "liveagent_ticket_list"],
      capability: "ticket_metadata_read",
      platformCapability: "liveagent_ticket_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five ticket operational summaries without subjects, message bodies, notes, customer identities, custom fields, tags, or attachments.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "liveagent.getTicket",
      functionName: "liveagent_ticket_get",
      aliases: ["liveagent.getTicket", "liveagent_ticket_get"],
      capability: "ticket_metadata_read",
      platformCapability: "liveagent_ticket_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact ticket's IDs, state, channel, routing, priority, and timestamps without returning content or customer data.",
      inputSchema: {
        type: "object",
        properties: {
          ticketId: { type: "string", minLength: 1, maxLength: 128 },
        },
        required: ["ticketId"],
        additionalProperties: false,
      },
    },
    {
      name: "liveagent.request",
      functionName: "liveagent_request",
      aliases: ["liveagent.request", "liveagent_request", "liveagent_full_api"],
      capability: "full_api",
      platformCapability: "liveagent_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented API v3 operation on the connected LiveAgent account. Absolute URLs, credentials, redirects, and version overrides are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          path: {
            type: "string",
            pattern: "^/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$",
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
      id: "liveagent_safe",
      label: "Safe",
      description:
        "Content-free ticket reads and every broader API v3 operation require approval; account-domain binding, secret isolation, provider permissions, and bounds remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...ticketReads, ...fullApi],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected key-authorized operations run without Relay per-action approval; account-domain binding, secret isolation, bounds, audits, provider permissions, and LiveAgent limits still apply.",
      defaultSelected: false,
      allowedActions: [...ticketReads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "list_tickets",
      label:
        "LiveAgent account domain, API key, permission, and bounded ticket-list check",
    },
  ],
};
