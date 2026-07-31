import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const query = action(
  "roadmunk_graphql_query",
  "Query Strategic Roadmaps",
  "Run one bounded, non-introspection GraphQL query against the selected Strategic Roadmaps region.",
);
const mutation = action(
  "roadmunk_graphql_mutation",
  "Manage Strategic Roadmaps",
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

export const ROADMUNK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "roadmunk",
  name: "Strategic Roadmaps (Roadmunk)",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://help.tempo.io/developers/latest/roadmunk",
  providerWebsiteUrl: "https://www.tempo.io/products/roadmaps",
  capabilities: [
    {
      ...capability(
        "roadmaps_read",
        "Read roadmaps and product data",
        "Read authorized roadmaps, items, fields, milestones, feedback, ideas, customers, contacts, products, components, account details, and users.",
        true,
      ),
      platformCapability: "roadmunk_roadmaps_read",
    },
    {
      ...capability(
        "roadmaps_manage",
        "Manage roadmaps and product data",
        "Create, update, and delete every resource supported by the current Strategic Roadmaps GraphQL API and customer token.",
        true,
      ),
      platformCapability: "roadmunk_roadmaps_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ROADMUNK_API_TOKEN",
        label: "Strategic Roadmaps API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "An account administrator creates this under Account settings > Integrations > API Tokens. Relay encrypts it and sends it only to the selected official regional gateway.",
      },
      {
        name: "ROADMUNK_REGION",
        label: "Data region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter na, eu, or apac to match the region where your Strategic Roadmaps account stores data.",
      },
    ],
  },
  tools: [
    {
      name: "roadmunk.query",
      functionName: "roadmunk_graphql_query",
      aliases: ["roadmunk.query", "roadmunk_graphql_query"],
      capability: "roadmaps_read",
      platformCapability: "roadmunk_roadmaps_read",
      action: "read",
      approvalRequired: false,
      description:
        "Execute one bounded GraphQL query at the connection's fixed Strategic Roadmaps regional gateway.",
      inputSchema: graphqlInputSchema,
    },
    {
      name: "roadmunk.mutate",
      functionName: "roadmunk_graphql_mutation",
      aliases: ["roadmunk.mutate", "roadmunk_graphql_mutation"],
      capability: "roadmaps_manage",
      platformCapability: "roadmunk_roadmaps_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Execute one bounded GraphQL mutation at the connection's fixed Strategic Roadmaps regional gateway; Safe mode requires approval.",
      inputSchema: graphqlInputSchema,
    },
  ],
  approvalProfiles: [
    {
      id: "roadmunk_safe",
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
        "Every selected token-authorized query or mutation runs without Relay per-action approval; ownership, the selected regional gateway, provider permissions, bounds, audits, and secret non-exposure still apply.",
      defaultSelected: false,
      allowedActions: [query, mutation],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "account",
      label: "Strategic Roadmaps API-token and account validation",
    },
  ],
};
