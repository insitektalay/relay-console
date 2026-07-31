import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "youcanbookme_api_read",
  "Read YouCanBookMe",
  "Read bounded authorized booking pages and bookings.",
);
const manage = action(
  "youcanbookme_api_manage",
  "Manage YouCanBookMe",
  "Create or update booking pages and bookings, and manage team members and appointment types.",
);
const guards = [
  action("youcanbookme_secret_exposure", "Expose credentials", "The API key remains encrypted, and neither credential enters agent-visible requests or results."),
  action("youcanbookme_unofficial_origin", "Use another API origin", "Every request stays on YouCanBookMe's documented API origin."),
  action("youcanbookme_unsupported_endpoint", "Call another endpoint", "Relay permits only YouCanBookMe's documented profiles, bookings, team-member, and appointment-type routes."),
  action("youcanbookme_unbounded_transfer", "Run an unbounded transfer", "Relay bounds queries, request bodies, responses, redirects, nesting, and execution time."),
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

export const YOUCANBOOKME_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "youcanbookme",
  name: "YouCanBookMe",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://ycbm.stoplight.io/",
  providerWebsiteUrl: "https://youcanbook.me/",
  capabilities: [
    { ...capability("schedule_read", "Read scheduling data", "Read the connected account's booking pages and bounded booking records.", true), platformCapability: "youcanbookme_schedule_read" },
    { ...capability("schedule_manage", "Manage scheduling", "Create and update booking pages and bookings, and add, update, or remove team members and appointment types.", true), platformCapability: "youcanbookme_schedule_manage" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "YOUCANBOOKME_ACCOUNT_ID", label: "YouCanBookMe account ID", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "Copy the account ID shown under My Account > Security > Authentication and API." },
      { name: "YOUCANBOOKME_API_KEY", label: "YouCanBookMe API key", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "The account owner creates this key under My Account > Security > Authentication and API. API keys start with ak_." },
    ],
  },
  tools: [
    {
      name: "youcanbookme.read",
      functionName: "youcanbookme_api_read",
      aliases: ["youcanbookme.read", "youcanbookme_api_read"],
      capability: "schedule_read",
      platformCapability: "youcanbookme_schedule_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact documented YouCanBookMe profiles or bookings endpoint.",
      inputSchema: { type: "object", properties: { path: { type: "string", minLength: 1, maxLength: 500 }, query: querySchema }, required: ["path"], additionalProperties: false },
    },
    {
      name: "youcanbookme.manage",
      functionName: "youcanbookme_api_manage",
      aliases: ["youcanbookme.manage", "youcanbookme_api_manage"],
      capability: "schedule_manage",
      platformCapability: "youcanbookme_schedule_manage",
      action: "write",
      approvalRequired: true,
      description: "Call one exact documented YouCanBookMe mutation with bounded JSON; Safe mode requires approval.",
      inputSchema: { type: "object", properties: { method: { type: "string", enum: ["POST", "PATCH", "DELETE"] }, path: { type: "string", minLength: 1, maxLength: 500 }, query: querySchema, json: { type: "object" }, approvalId: { type: "string", maxLength: 200 } }, required: ["method", "path"], additionalProperties: false },
    },
  ],
  approvalProfiles: [
    { id: "youcanbookme_safe", label: "Safe", description: "Reads run directly. Every booking, booking-page, team-member, or appointment-type change requires approval.", defaultSelected: true, allowedActions: [read], approvalRequiredActions: [manage], blockedActions: guards },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected operation authorized by the connected YouCanBookMe key runs without Relay per-action approval. Account authority, exact routes, bounds, credential protection, provider limits, and audits still apply.", defaultSelected: false, allowedActions: [read, manage], approvalRequiredActions: [], blockedActions: guards },
  ],
  healthChecks: [{ id: "profiles", label: "YouCanBookMe account and API key validation" }],
};
