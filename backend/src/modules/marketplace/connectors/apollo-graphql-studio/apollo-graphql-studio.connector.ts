import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "apollo_graphos_graph_artifact_get",
    "Read graph artifact metadata",
    "Read the current OCI graph-artifact tag and digest metadata for the configured graph and variant through two fixed Platform API queries.",
  ),
  action(
    "apollo_graphos_launch_status_get",
    "Read launch status",
    "Read the status of one exact launch identifier for the configured graph and variant through one fixed Platform API query.",
  ),
];
const blocks = [
  blocked(
    "apollo_graphos_schema_operations_telemetry",
    "Block graph content and telemetry",
    "Schemas, SDL, subgraphs, operations, traces, metrics, insights, proposals, persisted queries, graph configuration, and organization data are unavailable.",
  ),
  blocked(
    "apollo_graphos_mutations_administration",
    "Block mutations and administration",
    "Schema publishing and checks, graph and variant changes, integration changes, API-key management, persisted-query changes, proposals, router settings, telemetry settings, and all other mutations are unavailable.",
  ),
  blocked(
    "apollo_graphos_raw_broad_credentials",
    "Block raw access and broad credentials",
    "Arbitrary GraphQL, introspection, fragments, user-supplied variables, batching, pagination, retries, redirects, personal keys, organization keys, operator keys, subgraph keys, cookies, and browser sessions are unavailable.",
  ),
];

export const APOLLO_GRAPHQL_STUDIO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "apollo-graphql-studio",
    name: "Apollo GraphQL Studio",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://www.apollographql.com/docs/graphos/platform/platform-api",
    providerWebsiteUrl: "https://www.apollographql.com/",
    capabilities: [
      {
        ...capability(
          "graph_artifact_metadata_read",
          "Read graph artifact metadata",
          "Read only current OCI artifact location and digest metadata for the configured graph variant.",
          true,
        ),
        platformCapability: "graph_artifact_metadata_read",
      },
      {
        ...capability(
          "launch_status_read",
          "Read launch status",
          "Read only the status of one exact launch for the configured graph variant.",
          true,
        ),
        platformCapability: "launch_status_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "APOLLO_GRAPHOS_API_KEY",
          label: "Customer-owned graph API key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Use a dedicated graph-scoped Consumer or Observer key, never a personal or organization-wide key. Relay encrypts its copy; delete the key in GraphOS Studio after disconnect.",
        },
        {
          name: "APOLLO_GRAPH_ID",
          label: "Graph ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText: "The exact GraphOS graph ID this connection may inspect.",
        },
        {
          name: "APOLLO_GRAPH_VARIANT",
          label: "Graph variant",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The exact GraphOS variant, such as current, this connection may inspect.",
        },
      ],
    },
    tools: [
      {
        name: "relay_apollo_graphos_get_graph_artifact",
        functionName: "relay_apollo_graphos_get_graph_artifact",
        aliases: ["apollo_graphos_graph_artifact_get"],
        capability: "graph_artifact_metadata_read",
        platformCapability: "graph_artifact_metadata_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read bounded OCI artifact tag, repository, digest, and URI metadata for the configured graph variant.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "relay_apollo_graphos_get_launch_status",
        functionName: "relay_apollo_graphos_get_launch_status",
        aliases: ["apollo_graphos_launch_status_get"],
        capability: "launch_status_read",
        platformCapability: "launch_status_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read the status of one exact launch in the configured graph variant.",
        inputSchema: {
          type: "object",
          properties: {
            launchId: {
              type: "string",
              minLength: 1,
              maxLength: 160,
              pattern: "^[A-Za-z0-9._:-]+$",
            },
          },
          required: ["launchId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "apollo_graphos_safe",
        label: "Safe",
        description:
          "Two fixed metadata reads run automatically; graph content, telemetry, mutations, administration, broad credentials, and raw GraphQL remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same two fixed reads run without per-action approval; fixed documents, exact graph binding, response reduction, audits, and provider limits still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      { id: "graph_api_key", label: "Dedicated graph-scoped API key" },
      { id: "graph_variant", label: "Exact graph and variant binding" },
    ],
  };
