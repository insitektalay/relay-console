import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "follow_up_boss_api_read",
  "Read Follow Up Boss",
  "Read bounded CRM, lead, event, activity, user, automation, and reference data through exact documented operations.",
);
const manage = action(
  "follow_up_boss_api_manage",
  "Manage Follow Up Boss",
  "Create or update selected CRM records and lead events through one exact documented operation.",
);
const guards = [
  action(
    "follow_up_boss_secret_exposure",
    "Expose credentials",
    "The customer API key, registered system key, OAuth tokens, and credential-shaped provider fields never enter agent-visible requests or results.",
  ),
  action(
    "follow_up_boss_unofficial_origin",
    "Use another API origin",
    "Every request stays on Follow Up Boss's documented https://api.followupboss.com/v1 API origin.",
  ),
  action(
    "follow_up_boss_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only selected V1 CRM, lead-event, activity, automation-read, user-read, and reference routes and blocks users, webhooks, inbox apps, email, texting, calling, raw OAuth app administration, and arbitrary API access.",
  ),
  action(
    "follow_up_boss_unbounded_transfer",
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

export const FOLLOW_UP_BOSS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "follow-up-boss",
  name: "Follow Up Boss",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.followupboss.com/reference/getting-started",
  providerWebsiteUrl: "https://www.followupboss.com/",
  capabilities: [
    {
      ...capability(
        "crm_read",
        "Read real-estate CRM data",
        "Read bounded people, leads, events, notes, calls, appointments, tasks, deals, users, automations, and reference data authorized by the connected Follow Up Boss user.",
        true,
      ),
      platformCapability: "follow_up_boss_crm_read",
    },
    {
      ...capability(
        "crm_manage",
        "Manage selected CRM records",
        "Create lead events and selected CRM records and update selected people, notes, calls, appointments, tasks, and deals through bounded documented V1 routes.",
        true,
      ),
      platformCapability: "follow_up_boss_crm_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FOLLOW_UP_BOSS_API_KEY",
        label: "Follow Up Boss API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Create a least-privilege user's API key under Admin > API. Relay encrypts it and sends it only to api.followupboss.com using HTTPS Basic authentication.",
      },
      {
        name: "FOLLOW_UP_BOSS_X_SYSTEM",
        label: "Registered system name",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Use the registered X-System name assigned to this Relay integration by Follow Up Boss.",
      },
      {
        name: "FOLLOW_UP_BOSS_X_SYSTEM_KEY",
        label: "Registered system key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use the X-System-Key assigned to this Relay integration. Relay encrypts it and never exposes it to agents.",
      },
    ],
  },
  tools: [
    {
      name: "follow-up-boss.read",
      functionName: "follow_up_boss_api_read",
      aliases: ["follow-up-boss.read", "follow_up_boss_api_read"],
      capability: "crm_read",
      platformCapability: "follow_up_boss_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one selected Follow Up Boss V1 route with bounded query parameters.",
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
      name: "follow-up-boss.manage",
      functionName: "follow_up_boss_api_manage",
      aliases: ["follow-up-boss.manage", "follow_up_boss_api_manage"],
      capability: "crm_manage",
      platformCapability: "follow_up_boss_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one selected Follow Up Boss V1 CRM or lead-event mutation; Safe mode requires approval.",
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
      id: "follow_up_boss_safe",
      label: "Safe",
      description:
        "Selected bounded reads run directly. Every lead event, record create, record update, and record deletion requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected Follow Up Boss mutations authorized by the connected user run without Relay per-action approval. Exact API-key user authority, registered-system headers, fixed origin, exact routes, bounds, redaction, provider limits, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "api-key",
      label: "Follow Up Boss identity and registered-system validation",
    },
  ],
};
