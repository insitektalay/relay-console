import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "aha_read",
  "Read Aha!",
  "Read bounded product records from the connected Aha! account.",
);
const manage = action(
  "aha_manage",
  "Manage Aha!",
  "Create, update, or delete authorized Aha! product records.",
);
const guards = [
  action(
    "aha_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible requests or results.",
  ),
  action(
    "aha_other_account",
    "Access another account",
    "Every request uses the Aha! account selected during sign-in.",
  ),
  action(
    "aha_unsupported_api",
    "Call an unsupported API",
    "Relay permits only documented Aha! REST v1 routes.",
  ),
  action(
    "aha_unbounded_transfer",
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

export const AHA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "aha",
  name: "Aha!",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.aha.io/api",
  providerWebsiteUrl: "https://www.aha.io/",
  capabilities: [
    {
      ...capability(
        "product_management_read",
        "Read product work",
        "Read the connected account's strategy, ideas, roadmaps, releases, features, goals, users, and development records.",
        true,
      ),
      platformCapability: "aha_read",
    },
    {
      ...capability(
        "product_management_manage",
        "Manage product work",
        "Create, update, and delete product records that the signed-in Aha! user is allowed to manage.",
        true,
      ),
      platformCapability: "aha_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://secure.aha.io/oauth/authorize",
      tokenUrl: "https://secure.aha.io/oauth/token",
      userInfoUrl: "https://secure.aha.io/api/v1/me",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    },
    credentialSchema: [
      {
        name: "AHA_CLIENT_ID",
        label: "Aha! OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
      },
      {
        name: "AHA_CLIENT_SECRET",
        label: "Aha! OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
      },
    ],
  },
  tools: [
    {
      name: "aha.read",
      functionName: "aha_read",
      aliases: ["aha.read"],
      capability: "product_management_read",
      platformCapability: "aha_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one documented Aha! REST v1 resource from the connected account.",
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
      name: "aha.manage",
      functionName: "aha_manage",
      aliases: ["aha.manage"],
      capability: "product_management_manage",
      platformCapability: "aha_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one documented Aha! REST v1 mutation in the connected account.",
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
      id: "aha_safe",
      label: "Safe",
      description:
        "Reads run directly. Every create, update, or delete requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Aha! action authorized by the connected user runs without Relay per-action approval. Account binding, Aha! permissions, request bounds, credential protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "account",
      label: "OAuth token and Aha! account validation",
    },
  ],
};
