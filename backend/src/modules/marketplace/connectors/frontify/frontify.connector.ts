import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const FRONTIFY_SCOPES = [
  "account:read",
  "basic:read",
  "basic:write",
  "webhook:read",
  "webhook:write",
];

const reads = [
  action(
    "frontify_query",
    "Read Frontify data",
    "Run one bounded query in the connected Frontify account.",
  ),
];
const writes = [
  action(
    "frontify_mutate",
    "Change Frontify data",
    "Run one bounded mutation; Safe mode requires approval.",
  ),
];
const blocked = [
  action(
    "frontify_secret_exposure",
    "Expose credentials",
    "OAuth credentials and signed provider URLs never enter agent-visible results.",
  ),
  action(
    "frontify_untrusted_origin",
    "Call another origin",
    "Requests remain pinned to the connected Frontify account.",
  ),
  action(
    "frontify_unbounded_transfer",
    "Transfer unbounded data",
    "Requests and responses remain inside Relay's bounded envelopes.",
  ),
];

const graphqlProperties = {
  document: { type: "string", minLength: 1, maxLength: 200_000 },
  variables: { type: "object" },
  operationName: { type: "string", maxLength: 200 },
};

export const FRONTIFY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "frontify",
  name: "Frontify",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://frontify.github.io/graphql-reference/",
  providerWebsiteUrl: "https://www.frontify.com/",
  capabilities: [
    {
      ...capability(
        "brand_read",
        "Browse brand content",
        "Search and read authorized accounts, brands, workspaces, libraries, projects, folders, assets, metadata, users, permissions, comments, licenses, workflows, catalogs, and webhooks.",
        true,
      ),
      platformCapability: "frontify_brand_read",
    },
    {
      ...capability(
        "brand_manage",
        "Manage brand content",
        "Create and change authorized assets, libraries, folders, collections, metadata, comments, licenses, workflows, brands, projects, catalogs, and webhooks.",
        true,
      ),
      platformCapability: "frontify_brand_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://{customer-domain}/api/oauth/authorize",
      tokenUrl: "https://{customer-domain}/api/oauth/accesstoken",
      userInfoUrl: "https://{customer-domain}/graphql",
      requiredScopes: FRONTIFY_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "FRONTIFY_DOMAIN",
        label: "Frontify domain",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Your Frontify hostname, such as brand.frontify.com.",
      },
      {
        name: "FRONTIFY_CLIENT_ID",
        label: "Client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Copy the Client ID from your Frontify OAuth application.",
      },
      {
        name: "FRONTIFY_CLIENT_SECRET",
        label: "Client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText: "Copy the Client Secret from the same OAuth application.",
      },
    ],
  },
  tools: [
    {
      name: "frontify.query",
      functionName: "frontify_query",
      aliases: ["frontify.query", "frontify_query"],
      capability: "brand_read",
      platformCapability: "frontify_brand_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one bounded query against Frontify's current GraphQL schema.",
      inputSchema: {
        type: "object",
        properties: graphqlProperties,
        required: ["document"],
        additionalProperties: false,
      },
    },
    {
      name: "frontify.mutate",
      functionName: "frontify_mutate",
      aliases: ["frontify.mutate", "frontify_mutate"],
      capability: "brand_manage",
      platformCapability: "frontify_brand_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one bounded mutation against Frontify's current GraphQL schema.",
      inputSchema: {
        type: "object",
        properties: {
          ...graphqlProperties,
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["document"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "frontify_safe",
      label: "Safe",
      description:
        "Bounded queries run directly; every mutation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: blocked,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected account-authorized operation runs without Relay per-action approval; fixed authority, bounds, redaction, audits, rate limits, and provider enforcement still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: blocked,
    },
  ],
  healthChecks: [
    {
      id: "current_user",
      label: "Frontify OAuth token and connected-user validation",
    },
  ],
};
