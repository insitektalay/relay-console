import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "tidio_ticket_list",
    "List ticket metadata",
    "List one fixed first page of content-free Tidio ticket summaries.",
  ),
  action(
    "tidio_ticket_get",
    "Read ticket metadata",
    "Read one exact Tidio ticket through Relay's content-free projection, discarding messages and customer data.",
  ),
];
const fullApi = [
  action(
    "tidio_full_api",
    "Use OpenAPI",
    "Use a documented Tidio OpenAPI operation authorized by the connected client keypair; Safe mode requires approval.",
  ),
];

export const TIDIO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "tidio",
  name: "Tidio",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.tidio.com/reference",
  providerWebsiteUrl: "https://www.tidio.com/",
  capabilities: [
    {
      ...capability(
        "ticket_metadata_read",
        "Read ticket operations",
        "List and inspect bounded ticket operational metadata without subjects, messages, internal notes, contacts, names, emails, phones, custom fields, tags, or raw records.",
        true,
      ),
      platformCapability: "tidio_ticket_metadata_read",
    },
    {
      ...capability(
        "full_api",
        "Tidio OpenAPI",
        "Use documented fixed-origin OpenAPI paths and methods allowed by the connected client keypair.",
        true,
      ),
      platformCapability: "tidio_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TIDIO_OPENAPI_CLIENT_ID",
        label: "Tidio OpenAPI client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the customer-generated OpenAPI client ID (prefixed ci_).",
      },
      {
        name: "TIDIO_OPENAPI_CLIENT_SECRET",
        label: "Tidio OpenAPI client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the secret from the same OpenAPI keypair (prefixed cs_).",
      },
    ],
  },
  tools: [
    {
      name: "tidio.listTickets",
      functionName: "tidio_ticket_list",
      aliases: ["tidio.listTickets", "tidio_ticket_list"],
      capability: "ticket_metadata_read",
      platformCapability: "tidio_ticket_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five first-page ticket operational summaries without messages or customer data; cursor traversal is not exposed.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "tidio.getTicket",
      functionName: "tidio_ticket_get",
      aliases: ["tidio.getTicket", "tidio_ticket_get"],
      capability: "ticket_metadata_read",
      platformCapability: "tidio_ticket_metadata_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact ticket's ID, state, priority, routing, channel, and timestamps while discarding messages and customer data.",
      inputSchema: {
        type: "object",
        properties: { ticketId: { type: "integer", minimum: 1 } },
        required: ["ticketId"],
        additionalProperties: false,
      },
    },
    {
      name: "tidio.request",
      functionName: "tidio_request",
      aliases: ["tidio.request", "tidio_request", "tidio_full_api"],
      capability: "full_api",
      platformCapability: "tidio_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call one documented Tidio OpenAPI operation on the fixed api.tidio.com origin. Absolute URLs, credentials, redirects, and origin overrides are rejected.",
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
      id: "tidio_safe",
      label: "Safe",
      description:
        "Content-free ticket reads and every broader OpenAPI operation require approval; fixed origin, secret isolation, provider plan/access, and bounds remain enforced.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [...reads, ...fullApi],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected keypair-authorized operations run without Relay per-action approval; fixed origin, secret isolation, bounds, audits, and Tidio plan/access controls still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "project",
      label: "Tidio OpenAPI client keypair and authenticated project check",
    },
  ],
};
