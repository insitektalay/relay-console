import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "onepagecrm_api_read",
  "Read OnePageCRM",
  "Read bounded core CRM records, streams, users, and reference configuration through exact documented operations.",
);
const manage = action(
  "onepagecrm_api_manage",
  "Manage OnePageCRM",
  "Create, update, complete, restore, or delete core CRM records through an exact documented operation.",
);
const guards = [
  action(
    "onepagecrm_secret_exposure",
    "Expose credentials",
    "The customer user ID and API key never enter agent-visible requests or results.",
  ),
  action(
    "onepagecrm_unofficial_origin",
    "Use another API origin",
    "Every request stays on OnePageCRM's documented HTTPS API origin.",
  ),
  action(
    "onepagecrm_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only selected stable core CRM and read-only reference routes from the current V3 contract.",
  ),
  action(
    "onepagecrm_unbounded_transfer",
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

export const ONEPAGECRM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "onepagecrm",
  name: "OnePageCRM",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.onepagecrm.com/api/reference/",
  providerWebsiteUrl: "https://www.onepagecrm.com/",
  capabilities: [
    {
      ...capability(
        "crm_read",
        "Read CRM and reference data",
        "Read contacts, companies, deals, actions, notes, calls, meetings, streams, users, and stable reference configuration.",
        true,
      ),
      platformCapability: "onepagecrm_crm_read",
    },
    {
      ...capability(
        "crm_manage",
        "Manage core CRM records",
        "Create supported contact-owned records and manage contacts, companies, deals, actions, notes, calls, and meetings, including selected exact action-state transitions.",
        true,
      ),
      platformCapability: "onepagecrm_crm_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ONEPAGECRM_USER_ID",
        label: "OnePageCRM user ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Copy the user_id from OnePageCRM's API settings Configuration tab. Relay binds health checks to this exact user.",
      },
      {
        name: "ONEPAGECRM_API_KEY",
        label: "OnePageCRM API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Copy the API key paired with that user_id. Relay encrypts it and sends it only to app.onepagecrm.com.",
      },
    ],
  },
  tools: [
    {
      name: "onepagecrm.read",
      functionName: "onepagecrm_api_read",
      aliases: ["onepagecrm.read", "onepagecrm_api_read"],
      capability: "crm_read",
      platformCapability: "onepagecrm_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one selected OnePageCRM V3 route. Supply a path without the .json suffix and bounded query parameters.",
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
      name: "onepagecrm.manage",
      functionName: "onepagecrm_api_manage",
      aliases: ["onepagecrm.manage", "onepagecrm_api_manage"],
      capability: "crm_manage",
      platformCapability: "onepagecrm_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one selected OnePageCRM V3 core-record mutation; Safe mode requires approval.",
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
      id: "onepagecrm_safe",
      label: "Safe",
      description:
        "Selected bounded reads run directly. Every create, update, state transition, restoration, and deletion requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected core CRM mutations authorized by the connected OnePageCRM user run without Relay per-action approval. Exact user binding, provider roles, fixed origin, exact routes, bounds, redaction, provider limits, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "api-key", label: "OnePageCRM exact-user API-key validation" },
  ],
};
