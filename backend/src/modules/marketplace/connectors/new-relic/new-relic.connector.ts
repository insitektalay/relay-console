import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "new_relic_search_entities",
    "Search entities",
    "Search at most twenty-five entity health summaries in the bound account.",
  ),
  action(
    "new_relic_get_entity",
    "Read entity",
    "Read one exact entity's bounded status and tags.",
  ),
  action(
    "new_relic_read_account_health",
    "Read account health",
    "Read a fixed one-hour aggregate Transaction health summary for the bound account.",
  ),
];
const blockedActions = [
  blocked(
    "new_relic_mutation",
    "Change New Relic",
    "Entity, workload, dashboard, alert, issue, configuration, and other mutations are outside V1.",
  ),
  blocked(
    "new_relic_private_telemetry",
    "Read private telemetry",
    "Raw events, logs, traces, spans, errors, attributes, messages, and historical exports are outside V1.",
  ),
  blocked(
    "new_relic_arbitrary_query",
    "Run arbitrary queries",
    "Arbitrary GraphQL, NRQL, accounts, cursors, pagination, introspection, and raw responses are outside V1.",
  ),
  blocked(
    "new_relic_ingestion",
    "Ingest telemetry",
    "License keys, ingest endpoints, agents, and telemetry submission are outside V1.",
  ),
  blocked(
    "new_relic_admin",
    "Administer New Relic",
    "Users, roles, authentication domains, keys, billing, security, and administration are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const NEW_RELIC_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "new-relic",
  name: "New Relic",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.newrelic.com/docs/apis/nerdgraph/get-started/introduction-new-relic-nerdgraph/",
  providerWebsiteUrl: "https://newrelic.com/",
  capabilities: [
    {
      ...capability(
        "entity_read",
        "Read entities",
        "Search and inspect bounded entity health summaries in one exact account.",
        true,
      ),
      platformCapability: "new_relic_entity_read",
    },
    {
      ...capability(
        "account_health",
        "Read account health",
        "Read a fixed one-hour aggregate Transaction health summary.",
        true,
      ),
      platformCapability: "new_relic_account_health",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "NEW_RELIC_USER_API_KEY",
        label: "New Relic user API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a user API key for the connecting New Relic user; Relay encrypts it and never exposes it to agents.",
      },
      {
        name: "NEW_RELIC_ACCOUNT_ID",
        label: "New Relic account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Bind this connection to one exact accessible account ID.",
      },
      {
        name: "NEW_RELIC_REGION",
        label: "New Relic region",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter us or eu to select the exact NerdGraph origin.",
      },
    ],
  },
  tools: [
    {
      name: "newRelic.searchEntities",
      functionName: "new_relic_search_entities",
      aliases: ["newRelic.searchEntities", "new_relic_search_entities"],
      capability: "entity_read",
      platformCapability: "new_relic_entity_read",
      action: "read",
      approvalRequired: true,
      description:
        "Search bounded entity health summaries in the bound account.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 300 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "newRelic.getEntity",
      functionName: "new_relic_get_entity",
      aliases: ["newRelic.getEntity", "new_relic_get_entity"],
      capability: "entity_read",
      platformCapability: "new_relic_entity_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded entity health summary.",
      inputSchema: {
        type: "object",
        properties: {
          guid: { type: "string", pattern: "^[A-Za-z0-9_-]{8,128}$" },
          approvalId,
        },
        required: ["guid"],
        additionalProperties: false,
      },
    },
    {
      name: "newRelic.readAccountHealth",
      functionName: "new_relic_read_account_health",
      aliases: ["newRelic.readAccountHealth", "new_relic_read_account_health"],
      capability: "account_health",
      platformCapability: "new_relic_account_health",
      action: "read",
      approvalRequired: true,
      description:
        "Read a fixed one-hour aggregate Transaction health summary.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "new_relic_safe",
      label: "Safe",
      description:
        "All three bounded observability reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while account ownership, user-key authority, fixed queries, limits, redaction, audit, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "bound-account",
      label:
        "New Relic key, exact account, region, authority, and NerdGraph validation",
    },
  ],
};
