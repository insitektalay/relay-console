import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "vagaro_api_read",
  "Read Vagaro",
  "Run one bounded operation from Vagaro's complete documented retrieval surface.",
);
const manage = action(
  "vagaro_api_manage",
  "Manage Vagaro",
  "Run one documented mutation for employees, locations, customers, appointments, services, or personal tasks.",
);
const guards = [
  action(
    "vagaro_secret_exposure",
    "Expose credentials",
    "The customer-owned client secret and derived access tokens never enter agent-visible requests or results.",
  ),
  action(
    "vagaro_unofficial_origin",
    "Use another API origin",
    "Every token and business request stays on Vagaro's documented fixed API origin and configured regional path.",
  ),
  action(
    "vagaro_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only the 27 current public Vagaro operations represented by the read and manage tools.",
  ),
  action(
    "vagaro_unbounded_transfer",
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

export const VAGARO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vagaro",
  name: "Vagaro",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.vagaro.com/public/docs/introduction",
  providerWebsiteUrl: "https://www.vagaro.com/",
  capabilities: [
    {
      ...capability(
        "business_read",
        "Read business and scheduling data",
        "Read access levels, locations, customers, availability, appointments, employees, services, personal tasks, and cancellation policies through every documented retrieval operation.",
        true,
      ),
      platformCapability: "vagaro_business_read",
    },
    {
      ...capability(
        "business_manage",
        "Manage business and scheduling data",
        "Assign employees and manage working hours, locations, customers, appointments, employees, services, and personal tasks through every documented mutation.",
        true,
      ),
      platformCapability: "vagaro_business_manage",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "VAGARO_CLIENT_ID",
        label: "Vagaro client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Copy the client ID from Developer Settings after Vagaro activates APIs & Webhooks for the business.",
      },
      {
        name: "VAGARO_CLIENT_SECRET",
        label: "Vagaro client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Copy the client secret from Developer Settings. This is not the user's Vagaro password.",
      },
      {
        name: "VAGARO_REGION",
        label: "Vagaro region",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Enter the regional code from the business account URL, such as us04.",
      },
    ],
  },
  tools: [
    {
      name: "vagaro.read",
      functionName: "vagaro_api_read",
      aliases: ["vagaro.read", "vagaro_api_read"],
      capability: "business_read",
      platformCapability: "vagaro_business_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one exact documented Vagaro retrieval operation, including retrieval routes that use POST.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST"], default: "POST" },
          path: { type: "string", minLength: 1, maxLength: 500 },
          query: querySchema,
          json: { type: "object" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "vagaro.manage",
      functionName: "vagaro_api_manage",
      aliases: ["vagaro.manage", "vagaro_api_manage"],
      capability: "business_manage",
      platformCapability: "vagaro_business_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one exact documented Vagaro mutation; Safe mode requires approval.",
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
    {
      id: "vagaro_safe",
      label: "Safe",
      description:
        "Documented retrieval operations run directly. Every employee, location, customer, appointment, service, or personal-task mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every documented operation authorized by the connected Vagaro business runs without Relay per-action approval. Business authority, exact routes, scope selection, bounds, credential protection, provider limits, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "credentials", label: "Vagaro client-credential validation" },
  ],
};
