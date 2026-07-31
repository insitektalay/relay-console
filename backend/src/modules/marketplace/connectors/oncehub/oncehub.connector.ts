import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "oncehub_api_read",
  "Read OnceHub",
  "Read bounded bookings, booking calendars, availability, booking pages, event types, contacts, users, teams, notifications, and webhooks.",
);
const manage = action(
  "oncehub_api_manage",
  "Manage OnceHub",
  "Schedule, cancel, reschedule, reassign, or mark bookings as no-shows; create one-time links; and manage users, availability, contacts, and webhooks.",
);
const guards = [
  action("oncehub_secret_exposure", "Expose credentials", "The customer API key never enters agent-visible requests or results."),
  action("oncehub_unofficial_origin", "Use another API origin", "Every request stays on OnceHub's documented v2 API origin."),
  action("oncehub_unsupported_endpoint", "Call another endpoint", "Relay permits only operations in OnceHub's current Booking Calendars and Booking Pages OpenAPI documents."),
  action("oncehub_unbounded_transfer", "Run an unbounded transfer", "Relay bounds queries, request bodies, responses, redirects, nesting, and execution time."),
];
const querySchema = {
  type: "object",
  additionalProperties: {
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] }, maxItems: 100 },
    ],
  },
};

export const ONCEHUB_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "oncehub",
  name: "OnceHub",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.oncehub.com/",
  providerWebsiteUrl: "https://oncehub.com/",
  capabilities: [
    {
      ...capability("schedule_read", "Read scheduling data", "Read every documented non-mutating v2 operation for bookings, booking calendars, availability, classic booking pages, event types, master pages, notifications, users, teams, contacts, and webhooks.", true),
      platformCapability: "oncehub_schedule_read",
    },
    {
      ...capability("schedule_manage", "Manage scheduling", "Use every documented mutating v2 operation for bookings, scheduling, one-time links, users, availability, contacts, and webhooks.", true),
      platformCapability: "oncehub_schedule_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ONCEHUB_API_KEY",
        label: "OnceHub API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Create an API key in OnceHub under Account Integrations → APIs & Webhooks → API Keys, then copy it here. OnceHub displays it only once.",
      },
    ],
  },
  tools: [
    {
      name: "oncehub.read",
      functionName: "oncehub_api_read",
      aliases: ["oncehub.read", "oncehub_api_read"],
      capability: "schedule_read",
      platformCapability: "oncehub_schedule_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact documented OnceHub v2 endpoint.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", minLength: 1, maxLength: 500 }, query: querySchema },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "oncehub.manage",
      functionName: "oncehub_api_manage",
      aliases: ["oncehub.manage", "oncehub_api_manage"],
      capability: "schedule_manage",
      platformCapability: "oncehub_schedule_manage",
      action: "write",
      approvalRequired: true,
      description: "Call one exact documented OnceHub v2 mutation with bounded JSON; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PATCH", "DELETE"] },
          path: { type: "string", minLength: 1, maxLength: 500 },
          query: querySchema,
          json: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "oncehub_safe",
      label: "Safe",
      description: "Reads run directly. Every booking, one-time-link, user, availability, contact, or webhook change requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: "Every documented operation authorized by the customer's OnceHub API key runs without Relay per-action approval. Credential authority, fixed routes, bounds, provider limits, redaction, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [{ id: "api-key", label: "OnceHub API-key validation" }],
};
