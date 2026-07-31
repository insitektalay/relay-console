import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "chime_crm_api_read",
  "Read Chime CRM",
  "Read bounded Lofty Open API team, user, lead, communication, call, calendar, task, appointment, and manual-log data through exact documented operations.",
);
const manage = action(
  "chime_crm_api_manage",
  "Manage Chime CRM",
  "Create or update selected calendar entries and manual communication logs through one exact documented operation.",
);
const guards = [
  action(
    "chime_crm_secret_exposure",
    "Expose credentials",
    "The customer API key, OAuth client secrets, access tokens, refresh tokens, and credential-shaped provider fields never enter agent-visible requests or results.",
  ),
  action(
    "chime_crm_unofficial_origin",
    "Use another API origin",
    "Every request stays on Lofty's documented https://api.lofty.com Open API origin and never falls back to the legacy api.chime.me host.",
  ),
  action(
    "chime_crm_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only selected Open API CRM, team, communication-history, call, calendar, task, appointment, and manual-log routes and blocks org/user administration, outbound SMS/email, OAuth app administration, webhooks, broad exports, and arbitrary API access.",
  ),
  action(
    "chime_crm_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds limits, offsets, query fields, arrays, bodies, responses, redirects, nesting, and execution time and never follows pagination automatically.",
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

export const CHIME_CRM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "chime-crm",
  name: "Chime CRM",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.lofty.com/docs/reference",
  providerWebsiteUrl: "https://lofty.com/",
  capabilities: [
    {
      ...capability(
        "crm_read",
        "Read Lofty real-estate CRM data",
        "Read bounded team, user, lead, communication-history, call, calendar, task, appointment, manual-log, and organization data authorized by the connected Lofty API key.",
        true,
      ),
      platformCapability: "chime_crm_read",
    },
    {
      ...capability(
        "crm_manage",
        "Manage calendar and activity logs",
        "Create, update, finish, unfinish, and delete selected calendar entries and create or delete manual communication logs through bounded documented routes.",
        true,
      ),
      platformCapability: "chime_crm_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CHIME_CRM_API_KEY",
        label: "Lofty Open API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Copy the API key from Chime/Lofty Settings > Integrations > API for a dedicated least-privilege user. Relay encrypts it and sends it only to api.lofty.com.",
      },
    ],
  },
  tools: [
    {
      name: "chime-crm.read",
      functionName: "chime_crm_api_read",
      aliases: ["chime-crm.read", "chime_crm_api_read"],
      capability: "crm_read",
      platformCapability: "chime_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one selected Lofty Open API route with bounded query parameters.",
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
      name: "chime-crm.manage",
      functionName: "chime_crm_api_manage",
      aliases: ["chime-crm.manage", "chime_crm_api_manage"],
      capability: "crm_manage",
      platformCapability: "chime_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one selected Lofty Open API calendar or manual-log mutation; Safe mode requires approval.",
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
      id: "chime_crm_safe",
      label: "Safe",
      description:
        "Selected bounded reads run directly. Every calendar entry change and manual communication log mutation requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected Lofty calendar and manual-log mutations authorized by the connected API key run without Relay per-action approval. Exact API-key user authority, fixed origin, exact routes, bounds, redaction, provider limits, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [{ id: "api-key", label: "Chime CRM / Lofty API key health" }],
};
