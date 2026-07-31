import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "folk_crm_api_read",
  "Read folk CRM",
  "Read bounded people, companies, deals, groups, custom-field definitions, users, notes, reminders, and webhook configuration through documented operations.",
);
const manage = action(
  "folk_crm_api_manage",
  "Manage folk CRM",
  "Create, update, or delete CRM records, notes, reminders, deals, and webhooks, or log one interaction through an exact documented operation.",
);
const guards = [
  action(
    "folk_crm_secret_exposure",
    "Expose credentials",
    "The customer API key and webhook signing secrets never enter agent-visible requests or results.",
  ),
  action(
    "folk_crm_unofficial_origin",
    "Use another API origin",
    "Every request stays on folk's documented HTTPS API origin.",
  ),
  action(
    "folk_crm_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only the current documented V1 routes and methods.",
  ),
  action(
    "folk_crm_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds pagination, query fields, arrays, bodies, responses, redirects, nesting, and execution time.",
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

export const FOLK_CRM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "folk-crm",
  name: "folk CRM",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.folk.app/api-reference/overview",
  providerWebsiteUrl: "https://www.folk.app/",
  capabilities: [
    {
      ...capability(
        "crm_read",
        "Read CRM and configuration",
        "Read all documented non-mutating folk resources for people, companies, deals, groups, custom fields, users, notes, reminders, and webhooks.",
        true,
      ),
      platformCapability: "folk_crm_read",
    },
    {
      ...capability(
        "crm_manage",
        "Manage CRM and automations",
        "Use all documented folk mutations for people, companies, deals, notes, reminders, interactions, and webhooks.",
        true,
      ),
      platformCapability: "folk_crm_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FOLK_CRM_API_KEY",
        label: "folk API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Create a dedicated key in folk workspace Settings → API. Relay encrypts it and sends it only to api.folk.app.",
      },
    ],
  },
  tools: [
    {
      name: "folk-crm.read",
      functionName: "folk_crm_api_read",
      aliases: ["folk-crm.read", "folk_crm_api_read"],
      capability: "crm_read",
      platformCapability: "folk_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact documented folk V1 endpoint with bounded query parameters.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", minLength: 1, maxLength: 2000 },
          query: querySchema,
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "folk-crm.manage",
      functionName: "folk_crm_api_manage",
      aliases: ["folk-crm.manage", "folk_crm_api_manage"],
      capability: "crm_manage",
      platformCapability: "folk_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one exact documented folk mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PATCH", "DELETE"] },
          path: { type: "string", minLength: 1, maxLength: 2000 },
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
      id: "folk_crm_safe",
      label: "Safe",
      description:
        "Documented bounded reads run directly. Every record, note, reminder, interaction, deal, webhook, and deletion mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every documented operation authorized by the connected folk user runs without Relay per-action approval. Connection ownership, provider roles, exact routes, fixed origin, version pinning, bounds, redaction, provider limits, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "api-key", label: "folk current-user API-key validation" },
  ],
};
