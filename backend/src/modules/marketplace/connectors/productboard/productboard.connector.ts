import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const PRODUCTBOARD_REQUIRED_SCOPES = [
  "entities:read",
  "entities:write",
  "entities:delete",
  "notes:read",
  "notes:write",
  "notes:delete",
  "analytics:read",
  "members:pii:read",
] as const;

const read = action(
  "productboard_read",
  "Read Productboard",
  "Read bounded product structures, feedback, people, integrations, webhooks, and analytics from the connected workspace.",
);
const manage = action(
  "productboard_manage",
  "Manage Productboard",
  "Create, update, or delete authorized Productboard records and integration resources.",
);
const guards = [
  action(
    "productboard_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible requests or results.",
  ),
  action(
    "productboard_other_workspace",
    "Access another workspace",
    "Every request uses the Productboard workspace selected during sign-in.",
  ),
  action(
    "productboard_unsupported_api",
    "Call an unsupported API",
    "Relay permits only documented Productboard REST v2 routes.",
  ),
  action(
    "productboard_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds queries, request bodies, responses, redirects, and execution time.",
  ),
];

const querySchema = {
  type: "object",
  additionalProperties: {
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      { type: "array", items: { type: "string" }, maxItems: 100 },
    ],
  },
};

export const PRODUCTBOARD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "productboard",
  name: "Productboard",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.productboard.com/reference/introduction",
  providerWebsiteUrl: "https://www.productboard.com/",
  capabilities: [
    {
      ...capability(
        "product_management_read",
        "Read product work",
        "Read product hierarchies, objectives, releases, notes, teams, members, integrations, webhooks, and analytics.",
        true,
      ),
      platformCapability: "productboard_read",
    },
    {
      ...capability(
        "product_management_manage",
        "Manage product work",
        "Create, update, and delete authorized product records, feedback, integrations, and webhooks.",
        true,
      ),
      platformCapability: "productboard_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.productboard.com/oauth2/authorize",
      tokenUrl: "https://app.productboard.com/oauth2/token",
      revocationUrl: "https://app.productboard.com/oauth2/revoke",
      userInfoUrl: "https://app.productboard.com/oauth2/token/info",
      requiredScopes: [...PRODUCTBOARD_REQUIRED_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "PRODUCTBOARD_CLIENT_ID",
        label: "Productboard OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
      },
      {
        name: "PRODUCTBOARD_CLIENT_SECRET",
        label: "Productboard OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
      },
    ],
  },
  tools: [
    {
      name: "productboard.read",
      functionName: "productboard_read",
      aliases: ["productboard.read"],
      capability: "product_management_read",
      platformCapability: "productboard_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one documented Productboard REST v2 resource from the connected workspace.",
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
      name: "productboard.manage",
      functionName: "productboard_manage",
      aliases: ["productboard.manage"],
      capability: "product_management_manage",
      platformCapability: "productboard_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one documented Productboard REST v2 mutation in the connected workspace.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PUT", "PATCH", "DELETE"] },
          path: { type: "string", minLength: 1, maxLength: 2000 },
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
      id: "productboard_safe",
      label: "Safe",
      description:
        "Reads run directly. Every create, update, delete, integration change, or webhook change requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Productboard action authorized by the connected account runs without Relay per-action approval. Workspace binding, provider permissions, request bounds, credential protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "workspace",
      label: "OAuth token and Productboard workspace validation",
    },
  ],
};
