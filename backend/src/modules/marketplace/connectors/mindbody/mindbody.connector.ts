import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "mindbody_api_read",
  "Read Mindbody",
  "Run one bounded GET operation from Mindbody's complete current Public API V6 business surface.",
);
const manage = action(
  "mindbody_api_manage",
  "Manage Mindbody",
  "Run one documented Public API V6 mutation for the activated Mindbody site.",
);
const guards = [
  action(
    "mindbody_secret_exposure",
    "Expose credentials",
    "The customer-owned API key and staff token never enter agent-visible requests or results.",
  ),
  action(
    "mindbody_unofficial_origin",
    "Use another API origin",
    "Every request stays on Mindbody's documented Public API origin and V6 path.",
  ),
  action(
    "mindbody_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only the 145 current business operations in the official Public API SDK; user-token issuance, renewal, and revocation remain connection lifecycle operations.",
  ),
  action(
    "mindbody_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds query fields, request bodies, responses, redirects, nesting, and execution time.",
  ),
];
const querySchema = {
  type: "object",
  additionalProperties: {
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      {
        type: "array",
        items: {
          oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
        },
        maxItems: 50,
      },
    ],
  },
};

export const MINDBODY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "mindbody",
  name: "Mindbody",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.mindbodyonline.com/ui/documentation/public-api",
  providerWebsiteUrl: "https://www.mindbodyonline.com/business",
  capabilities: [
    {
      ...capability(
        "business_read",
        "Read Mindbody business data",
        "Read the complete current Public API V6 surface for sites, scheduling, classes, appointments, clients, staff, enrollments, payroll, sales, products, services, and Pick a Spot.",
        true,
      ),
      platformCapability: "mindbody_business_read",
    },
    {
      ...capability(
        "business_manage",
        "Manage Mindbody business data",
        "Run every current Public API V6 business mutation for schedules, appointments, classes, clients, staff, enrollments, sales, products, services, and reservations.",
        true,
      ),
      platformCapability: "mindbody_business_manage",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "MINDBODY_API_KEY",
        label: "Mindbody API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Create this in the customer's approved Mindbody Developer Portal account. API usage and billing remain with that account.",
      },
      {
        name: "MINDBODY_SITE_ID",
        label: "Mindbody site ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Enter the activated business site ID. Use -99 only for Mindbody's developer sandbox.",
      },
      {
        name: "MINDBODY_STAFF_TOKEN",
        label: "Mindbody staff token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Provide a staff user token with the permissions needed for the selected business operations. This is not the staff member's password.",
      },
    ],
  },
  tools: [
    {
      name: "mindbody.read",
      functionName: "mindbody_api_read",
      aliases: ["mindbody.read", "mindbody_api_read"],
      capability: "business_read",
      platformCapability: "mindbody_business_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one exact documented Mindbody Public API V6 GET operation for the activated site.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", minLength: 1, maxLength: 500 },
          query: querySchema,
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "mindbody.manage",
      functionName: "mindbody_api_manage",
      aliases: ["mindbody.manage", "mindbody_api_manage"],
      capability: "business_manage",
      platformCapability: "mindbody_business_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one exact documented Mindbody Public API V6 mutation for the activated site; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "PATCH", "DELETE"] },
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
      id: "mindbody_safe",
      label: "Safe",
      description:
        "Documented GET operations run directly. Every class, appointment, client, staff, enrollment, sale, product, service, schedule, or reservation mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every documented business operation authorized by the connected Mindbody staff token runs without Relay per-action approval. Provider-granted site authority, exact routes, bounds, credential protection, provider limits, billing, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "site",
      label: "Mindbody API key, staff token, and activated-site validation",
    },
  ],
};
