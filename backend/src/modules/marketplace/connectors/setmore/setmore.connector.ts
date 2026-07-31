import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action("setmore_api_read", "Read Setmore", "Read bounded services, service categories, staff, availability slots, customers, and appointments.");
const manage = action("setmore_api_manage", "Manage Setmore", "Create customers and appointments or update an appointment label through Setmore's documented beta API.");
const guards = [
  action("setmore_secret_exposure", "Expose credentials", "The provider-issued refresh token and derived access tokens never enter agent-visible requests or results."),
  action("setmore_unofficial_origin", "Use another API origin", "Every token and scheduling request stays on Setmore's documented developer API origin."),
  action("setmore_unsupported_endpoint", "Call another endpoint", "Relay permits only the ten operations in Setmore's current public beta API documentation."),
  action("setmore_unbounded_transfer", "Run an unbounded transfer", "Relay bounds queries, request bodies, responses, redirects, nesting, and execution time."),
];
const querySchema = {
  type: "object",
  additionalProperties: {
    oneOf: [
      { type: "string" }, { type: "number" }, { type: "boolean" },
      { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] }, maxItems: 50 },
    ],
  },
};

export const SETMORE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "setmore",
  name: "Setmore",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://setmore.docs.apiary.io/",
  providerWebsiteUrl: "https://www.setmore.com/",
  capabilities: [
    { ...capability("schedule_read", "Read scheduling data", "Read all documented services, service categories, staff, availability slots, customer lookup, and appointment-list operations.", true), platformCapability: "setmore_schedule_read" },
    { ...capability("schedule_manage", "Manage scheduling", "Create customers and appointments or update an appointment label through every documented mutating beta API operation.", true), platformCapability: "setmore_schedule_manage" },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      { name: "SETMORE_REFRESH_TOKEN", label: "Setmore API refresh token", required: true, secret: true, storedIn: "encrypted_secret", helpText: "Setmore issues this after approving API access for a Pro account. This is not your account password." },
    ],
  },
  tools: [
    {
      name: "setmore.read",
      functionName: "setmore_api_read",
      aliases: ["setmore.read", "setmore_api_read"],
      capability: "schedule_read",
      platformCapability: "setmore_schedule_read",
      action: "read",
      approvalRequired: false,
      description: "Use one exact documented Setmore scheduling read, including the POST-based availability-slot lookup.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST"], default: "GET" },
          path: { type: "string", minLength: 1, maxLength: 500 },
          query: querySchema,
          json: { type: "object" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "setmore.manage",
      functionName: "setmore_api_manage",
      aliases: ["setmore.manage", "setmore_api_manage"],
      capability: "schedule_manage",
      platformCapability: "setmore_schedule_manage",
      action: "write",
      approvalRequired: true,
      description: "Call one exact documented Setmore customer or appointment mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT"] },
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
    { id: "setmore_safe", label: "Safe", description: "Documented reads and availability checks run directly. Every customer creation or appointment change requires approval.", defaultSelected: true, allowedActions: [read], approvalRequiredActions: [manage], blockedActions: guards },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every documented operation authorized by the connected Setmore refresh token runs without Relay per-action approval. Account authority, exact routes, bounds, token protection, provider limits, and audits still apply.", defaultSelected: false, allowedActions: [read, manage], approvalRequiredActions: [], blockedActions: guards },
  ],
  healthChecks: [{ id: "services", label: "Setmore refresh-token and services validation" }],
};
