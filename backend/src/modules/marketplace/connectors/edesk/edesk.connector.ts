import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "edesk_ticket_list",
    "List ticket metadata",
    "List a fixed first response of content-free eDesk ticket summaries.",
  ),
  action(
    "edesk_ticket_get",
    "Read ticket metadata",
    "Read one exact eDesk ticket through Relay's content-free projection.",
  ),
];
const full = [
  action(
    "edesk_full_api",
    "Use eDesk API v1",
    "Use a documented eDesk API v1 operation authorized by the configured token; Safe mode requires approval.",
  ),
];

export const EDESK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "edesk",
  name: "eDesk",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.edesk.com/reference",
  providerWebsiteUrl: "https://www.edesk.com/",
  capabilities: [
    {
      ...capability(
        "ticket_metadata_read",
        "Read ticket operations",
        "List and inspect bounded ticket operational metadata without subjects, messages, contacts, customer identities, channels, sales orders, tags, owners, custom fields, or raw records.",
        true,
      ),
      platformCapability: "edesk_ticket_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "eDesk API v1",
        "Use documented fixed-origin API v1 paths and methods allowed by the token's configured permissions.",
        true,
      ),
      platformCapability: "edesk_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "EDESK_API_TOKEN",
        label: "eDesk API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated expiring eDesk API token with the least permissions required.",
      },
    ],
  },
  tools: [
    {
      name: "edesk.listTickets",
      functionName: "edesk_ticket_list",
      aliases: ["edesk.listTickets", "edesk_ticket_list"],
      capability: "ticket_metadata_read",
      platformCapability: "edesk_ticket_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five recently updated ticket summaries without subjects, messages, contacts, identities, channel/order/tag/owner/custom-field data, or raw records.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "edesk.getTicket",
      functionName: "edesk_ticket_get",
      aliases: ["edesk.getTicket", "edesk_ticket_get"],
      capability: "ticket_metadata_read",
      platformCapability: "edesk_ticket_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact ticket's numeric ID, status, type, and timestamps through the same content-free projection.",
      inputSchema: {
        type: "object",
        properties: { ticketId: { type: "integer", minimum: 1 } },
        required: ["ticketId"],
        additionalProperties: false,
      },
    },
    {
      name: "edesk.request",
      functionName: "edesk_request",
      aliases: ["edesk.request", "edesk_request", "edesk_full_api"],
      capability: "full_api",
      platformCapability: "edesk_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented API v1 operation on eDesk's fixed origin. Absolute URLs, credentials, redirects, and version overrides are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          path: {
            type: "string",
            pattern: "^/v1/[A-Za-z0-9][A-Za-z0-9_./{}:-]{0,299}$",
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
      id: "edesk_safe",
      label: "Safe",
      description:
        "Content-free ticket reads and every broader API operation require approval; fixed origin/version, Bearer-token isolation, permission context, bounds, and provider limits remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...full],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected token-authorized operations run without Relay per-action approval; fixed origin/version, Bearer-token isolation, bounds, audits, permissions, and eDesk limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...full],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "whoami",
      label: "eDesk fixed-origin, Bearer-token, and caller identity check",
    },
  ],
};
