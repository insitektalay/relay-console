import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "savvycal_api_read",
  "Read SavvyCal",
  "Read bounded authorized account, event, scheduling-link, availability, webhook, and workflow data.",
);
const manage = action(
  "savvycal_api_manage",
  "Manage SavvyCal",
  "Create, update, duplicate, toggle, or delete scheduling links; book or cancel events; and manage webhooks.",
);
const guards = [
  action(
    "savvycal_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible requests or results.",
  ),
  action(
    "savvycal_unofficial_origin",
    "Use another API origin",
    "Every request stays on SavvyCal's documented API origin.",
  ),
  action(
    "savvycal_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only SavvyCal's documented public REST endpoints.",
  ),
  action(
    "savvycal_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds queries, request bodies, responses, redirects, nesting, and execution time.",
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

export const SAVVYCAL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "savvycal",
  name: "SavvyCal",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.savvycal.com/",
  providerWebsiteUrl: "https://savvycal.com/",
  capabilities: [
    {
      ...capability(
        "schedule_read",
        "Read scheduling data",
        "Read the connected SavvyCal account, events, scheduling links, available slots, time zones, webhooks, workflows, and workflow rules.",
        true,
      ),
      platformCapability: "savvycal_schedule_read",
    },
    {
      ...capability(
        "schedule_manage",
        "Manage scheduling",
        "Book and cancel events; create, update, duplicate, toggle, and delete scheduling links; and create or delete webhooks.",
        true,
      ),
      platformCapability: "savvycal_schedule_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://savvycal.com/oauth/authorize",
      tokenUrl: "https://savvycal.com/oauth/token",
      userInfoUrl: "https://api.savvycal.com/v1/me",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "SAVVYCAL_CLIENT_ID",
        label: "SavvyCal OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
      },
      {
        name: "SAVVYCAL_CLIENT_SECRET",
        label: "SavvyCal OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
      },
    ],
  },
  tools: [
    {
      name: "savvycal.read",
      functionName: "savvycal_api_read",
      aliases: ["savvycal.read", "savvycal_api_read"],
      capability: "schedule_read",
      platformCapability: "savvycal_schedule_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact documented SavvyCal endpoint.",
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
      name: "savvycal.manage",
      functionName: "savvycal_api_manage",
      aliases: ["savvycal.manage", "savvycal_api_manage"],
      capability: "schedule_manage",
      platformCapability: "savvycal_schedule_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one exact documented SavvyCal mutation with bounded JSON; Safe mode requires approval.",
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
      id: "savvycal_safe",
      label: "Safe",
      description:
        "Reads run directly. Every booking, cancellation, scheduling-link change, or webhook change requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected operation authorized by the connected SavvyCal user runs without Relay per-action approval. Provider authority, exact routes, bounds, credential protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "account", label: "OAuth token and SavvyCal account validation" },
  ],
};
