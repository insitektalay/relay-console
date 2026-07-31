import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "groove_account_get",
    "Read account",
    "Read the identity and state of the connected Groove account.",
  ),
  action(
    "groove_channel_list",
    "List channels",
    "List one bounded page of support channels from the connected Groove account.",
  ),
];

const fullApi = [
  action(
    "groove_full_api",
    "Use full Groove API",
    "Run a documented Groove GraphQL query or mutation authorized by the connected token; Safe mode requires approval.",
  ),
];

export const GROOVE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "groove",
  name: "Groove",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.groovehq.com/graphql/overview/start/",
  providerWebsiteUrl: "https://www.groovehq.com/",
  capabilities: [
    {
      ...capability(
        "account_read",
        "Read account details",
        "Verify and read the exact Groove account bound to this connection.",
        true,
      ),
      platformCapability: "groove_account_read",
    },
    {
      ...capability(
        "channel_read",
        "Read support channels",
        "List a bounded page of channels from the connected Groove account.",
        true,
      ),
      platformCapability: "groove_channel_read",
    },
    {
      ...capability(
        "full_api",
        "Full Groove API",
        "Use the complete current Groove GraphQL API surface authorized by the connected token.",
        true,
      ),
      platformCapability: "groove_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GROOVE_API_TOKEN",
        label: "Groove API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy an API token from Groove Settings > Organization > API. Its access follows the connected Groove account.",
      },
    ],
  },
  tools: [
    {
      name: "groove.getAccount",
      functionName: "groove_account_get",
      aliases: ["groove.getAccount", "groove_account_get"],
      capability: "account_read",
      platformCapability: "groove_account_read",
      action: "read",
      approvalRequired: false,
      description: "Read and verify the connected Groove account.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "groove.listChannels",
      functionName: "groove_channel_list",
      aliases: ["groove.listChannels", "groove_channel_list"],
      capability: "channel_read",
      platformCapability: "groove_channel_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five Groove support channels.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "groove.graphql",
      functionName: "groove_graphql",
      aliases: ["groove.graphql", "groove_graphql", "groove_full_api"],
      capability: "full_api",
      platformCapability: "groove_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Run a documented Groove GraphQL query or mutation against the fixed api.groovehq.com/v2/graphql endpoint. Credential-bearing variables are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 100000 },
          variables: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "groove_safe",
      label: "Safe",
      description:
        "Account and bounded channel reads run directly; every other Groove GraphQL operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected token-authorized Groove operation runs without Relay per-action approval; exact account binding, secret isolation, request bounds, audits, provider authority, and Groove limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "account-identity",
      label: "Groove API token and exact account validation",
    },
  ],
};
