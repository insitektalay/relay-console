import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const query = action(
  "healthie_graphql_query",
  "Query Healthie GraphQL",
  "Run one bounded, non-introspection GraphQL query against Healthie's fixed production API origin.",
);
const mutation = action(
  "healthie_graphql_mutation",
  "Mutate Healthie GraphQL",
  "Run one bounded Healthie GraphQL mutation; Safe mode requires approval.",
);

const graphqlInputSchema = {
  type: "object",
  properties: {
    document: { type: "string", minLength: 1, maxLength: 200000 },
    variables: { type: "object" },
    operationName: { type: "string", maxLength: 200 },
    approvalId: { type: "string" },
  },
  required: ["document"],
  additionalProperties: false,
};

export const HEALTHIE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "healthie",
  name: "Healthie",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.gethealthie.com/",
  providerWebsiteUrl: "https://www.gethealthie.com/",
  capabilities: [
    {
      ...capability(
        "healthcare_read",
        "Read Healthie data",
        "Run bounded GraphQL queries permitted by the customer-owned Healthie API key.",
        true,
      ),
      platformCapability: "healthie_healthcare_read",
    },
    {
      ...capability(
        "healthcare_write",
        "Manage Healthie workflows",
        "Run bounded GraphQL mutations permitted by the customer-owned Healthie API key.",
        true,
      ),
      platformCapability: "healthie_healthcare_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HEALTHIE_API_KEY",
        label: "Healthie API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated Healthie user or service-account API key. Railway encrypts it and sends it only to api.gethealthie.com.",
      },
      {
        name: "HEALTHIE_AUTHORIZATION_SHARD",
        label: "Shard authorization ID (if Healthie assigned one)",
        required: false,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Only accounts hosted on a Healthie data shard need this value; Healthie support supplies it.",
      },
    ],
  },
  tools: [
    {
      name: "healthie.query",
      functionName: "healthie_graphql_query",
      aliases: ["healthie.query", "healthie_graphql_query"],
      capability: "healthcare_read",
      platformCapability: "healthie_healthcare_read",
      action: "read",
      approvalRequired: false,
      description: "Execute one bounded GraphQL query at api.gethealthie.com/graphql.",
      inputSchema: graphqlInputSchema,
    },
    {
      name: "healthie.mutate",
      functionName: "healthie_graphql_mutation",
      aliases: ["healthie.mutate", "healthie_graphql_mutation"],
      capability: "healthcare_write",
      platformCapability: "healthie_healthcare_write",
      action: "write",
      approvalRequired: true,
      description:
        "Execute one bounded GraphQL mutation at api.gethealthie.com/graphql; Safe mode requires approval.",
      inputSchema: graphqlInputSchema,
    },
  ],
  approvalProfiles: [
    {
      id: "healthie_safe",
      label: "Safe",
      description: "GraphQL queries run directly; every mutation requires approval.",
      defaultSelected: true,
      allowedActions: [query],
      approvalRequiredActions: [mutation],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected API-key-authorized Healthie query or mutation runs without Relay per-action approval; connection ownership, fixed origin, bounds, audits, secret non-exposure, Healthie user permissions, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [query, mutation],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "current_user", label: "Healthie API-key and current-user validation" },
  ],
};
