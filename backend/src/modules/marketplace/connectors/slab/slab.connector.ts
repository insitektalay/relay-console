import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const query = action(
  "slab_graphql_query",
  "Query Slab GraphQL",
  "Run one bounded, non-introspection GraphQL query against the fixed Slab API origin.",
);
const mutation = action(
  "slab_graphql_mutation",
  "Mutate Slab GraphQL",
  "Run one bounded GraphQL mutation; Safe mode requires approval.",
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

export const SLAB_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "slab",
  name: "Slab",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://studio.apollographql.com/public/Slab/home",
  providerWebsiteUrl: "https://slab.com/",
  capabilities: [
    {
      ...capability(
        "knowledge_read",
        "Read Slab knowledge",
        "Run bounded GraphQL query operations against content the Slab Bot can access.",
        true,
      ),
      platformCapability: "slab_knowledge_read",
    },
    {
      ...capability(
        "knowledge_write",
        "Manage Slab knowledge",
        "Run bounded GraphQL mutation operations authorized by the team token and Slab Bot.",
        true,
      ),
      platformCapability: "slab_knowledge_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SLAB_API_TOKEN",
        label: "Slab team API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A Slab team admin copies this from Team settings > Developer. Railway encrypts it and sends it only to api.slab.com.",
      },
    ],
  },
  tools: [
    {
      name: "slab.query",
      functionName: "slab_graphql_query",
      aliases: ["slab.query", "slab_graphql_query"],
      capability: "knowledge_read",
      platformCapability: "slab_knowledge_read",
      action: "read",
      approvalRequired: false,
      description: "Execute one bounded GraphQL query at api.slab.com/graphql.",
      inputSchema: graphqlInputSchema,
    },
    {
      name: "slab.mutate",
      functionName: "slab_graphql_mutation",
      aliases: ["slab.mutate", "slab_graphql_mutation"],
      capability: "knowledge_write",
      platformCapability: "slab_knowledge_write",
      action: "write",
      approvalRequired: true,
      description:
        "Execute one bounded GraphQL mutation at api.slab.com/graphql; Safe mode requires approval.",
      inputSchema: graphqlInputSchema,
    },
  ],
  approvalProfiles: [
    {
      id: "slab_safe",
      label: "Safe",
      description:
        "GraphQL queries run directly; every mutation requires approval.",
      defaultSelected: true,
      allowedActions: [query],
      approvalRequiredActions: [mutation],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected token-authorized Slab query or mutation runs without Relay per-action approval; ownership, fixed origin, bounds, audits, secret non-exposure, Slab Bot access, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [query, mutation],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "current_user", label: "Slab API-token and current-user validation" },
  ],
};
