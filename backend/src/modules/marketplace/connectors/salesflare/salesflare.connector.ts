import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "salesflare_api_read",
  "Read Salesflare",
  "Read bounded CRM, workflow, interaction, user, pipeline, custom-field, email-source, tag, filter, person, and AI-settings data through documented operations.",
);
const manage = action(
  "salesflare_api_manage",
  "Manage Salesflare",
  "Create, update, delete, assign, communicate, automate, or administer through one exact documented Salesflare mutation.",
);
const guards = [
  action(
    "salesflare_secret_exposure",
    "Expose credentials",
    "The customer API key never enters agent-visible requests or results.",
  ),
  action(
    "salesflare_unofficial_origin",
    "Use another API origin",
    "Every request stays on Salesflare's documented HTTPS API origin.",
  ),
  action(
    "salesflare_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only the routes and methods pinned from Salesflare's current OpenAPI contract.",
  ),
  action(
    "salesflare_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay blocks export mode and bounds queries, list windows, bodies, responses, redirects, nesting, and execution time.",
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
        maxItems: 100,
      },
    ],
  },
};

export const SALESFLARE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "salesflare",
  name: "Salesflare",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.salesflare.com/docs",
  providerWebsiteUrl: "https://salesflare.com/",
  capabilities: [
    {
      ...capability(
        "crm_read",
        "Read CRM and configuration",
        "Read all documented non-mutating Salesflare resources for tasks, accounts, contacts, opportunities, workflows, interactions, users, groups, regional settings, pipelines, custom fields, email data sources, tags, filters, persons, and AI settings.",
        true,
      ),
      platformCapability: "salesflare_crm_read",
    },
    {
      ...capability(
        "crm_manage",
        "Manage CRM and automation",
        "Use all documented Salesflare mutations for CRM records, tasks, workflows, calls, meetings, internal notes, custom fields, email-source settings, tags, and AI settings.",
        true,
      ),
      platformCapability: "salesflare_crm_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SALESFLARE_API_KEY",
        label: "Salesflare API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Create a dedicated key in Salesflare under Settings → API keys. Relay encrypts it and sends it only to api.salesflare.com.",
      },
    ],
  },
  tools: [
    {
      name: "salesflare.read",
      functionName: "salesflare_api_read",
      aliases: ["salesflare.read", "salesflare_api_read"],
      capability: "crm_read",
      platformCapability: "salesflare_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact documented Salesflare endpoint with bounded query parameters.",
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
      name: "salesflare.manage",
      functionName: "salesflare_api_manage",
      aliases: ["salesflare.manage", "salesflare_api_manage"],
      capability: "crm_manage",
      platformCapability: "salesflare_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one exact documented Salesflare mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
          path: { type: "string", minLength: 1, maxLength: 500 },
          query: querySchema,
          json: {
            oneOf: [{ type: "object" }, { type: "array", maxItems: 1000 }],
          },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "salesflare_safe",
      label: "Safe",
      description:
        "Documented bounded reads run directly. Every CRM, workflow, communication, configuration, and deletion mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every documented operation authorized by the connected Salesflare user runs without Relay per-action approval. Connection ownership, provider roles, exact routes, bounds, export denial, redaction, provider limits, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "api-key", label: "Salesflare current-user API-key validation" },
  ],
};
