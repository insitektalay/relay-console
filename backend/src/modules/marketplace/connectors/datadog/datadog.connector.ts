import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const DATADOG_SCOPES = [
  "monitors_read",
  "incident_read",
  "apm_service_catalog_read",
];

const reads = [
  action(
    "datadog_search_monitors",
    "Search monitors",
    "Search at most twenty-five bounded monitor summaries.",
  ),
  action(
    "datadog_search_incidents",
    "Search incidents",
    "Search at most twenty-five bounded incident summaries.",
  ),
  action(
    "datadog_list_services",
    "List service definitions",
    "List at most twenty-five bounded service ownership summaries.",
  ),
];
const blockedActions = [
  blocked(
    "datadog_observability_write",
    "Change observability state",
    "Monitor, incident, service, dashboard, SLO, workflow, and configuration writes are outside V1.",
  ),
  blocked(
    "datadog_private_telemetry",
    "Read private telemetry",
    "Logs, traces, spans, events, metrics, RUM, sessions, notebooks, and raw telemetry are outside V1.",
  ),
  blocked(
    "datadog_ingestion",
    "Ingest telemetry",
    "Metrics, logs, traces, events, checks, and other ingestion are outside V1.",
  ),
  blocked(
    "datadog_key_admin",
    "Manage keys or administration",
    "API/application keys, users, roles, organizations, billing, security, and administration are outside V1.",
  ),
  blocked(
    "datadog_raw_api",
    "Use raw Datadog API",
    "Arbitrary hosts, paths, queries, cursors, pagination, bulk exports, and raw responses are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const commonInput = {
  type: "object",
  properties: {
    query: { type: "string", minLength: 1, maxLength: 500 },
    limit: { type: "integer", minimum: 1, maximum: 25 },
    approvalId,
  },
  additionalProperties: false,
};

export const DATADOG_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "datadog",
  name: "Datadog",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.datadoghq.com/api/latest/",
  providerWebsiteUrl: "https://www.datadoghq.com/",
  capabilities: [
    {
      ...capability(
        "monitor_read",
        "Read monitors",
        "Search bounded monitor status summaries.",
        true,
      ),
      platformCapability: "datadog_monitor_read",
    },
    {
      ...capability(
        "incident_read",
        "Read incidents",
        "Search bounded incident lifecycle summaries.",
        true,
      ),
      platformCapability: "datadog_incident_read",
    },
    {
      ...capability(
        "service_read",
        "Read services",
        "List bounded service definition and ownership summaries.",
        true,
      ),
      platformCapability: "datadog_service_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.datadoghq.com/oauth2/v1/authorize",
      tokenUrl: "https://api.datadoghq.com/oauth2/v1/token",
      refreshUrl: "https://api.datadoghq.com/oauth2/v1/token",
      revocationUrl: "https://api.datadoghq.com/oauth2/v1/revoke",
      requiredScopes: DATADOG_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "DATADOG_CLIENT_ID",
        label: "Datadog OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay-owned Partner Sandbox client ID stored on Railway.",
      },
      {
        name: "DATADOG_CLIENT_SECRET",
        label: "Datadog OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Relay-owned confidential client secret stored only on Railway.",
      },
    ],
  },
  tools: [
    {
      name: "datadog.searchMonitors",
      functionName: "datadog_search_monitors",
      aliases: ["datadog.searchMonitors", "datadog_search_monitors"],
      capability: "monitor_read",
      platformCapability: "datadog_monitor_read",
      action: "read",
      approvalRequired: true,
      description: "Search bounded Datadog monitor summaries.",
      inputSchema: commonInput,
    },
    {
      name: "datadog.searchIncidents",
      functionName: "datadog_search_incidents",
      aliases: ["datadog.searchIncidents", "datadog_search_incidents"],
      capability: "incident_read",
      platformCapability: "datadog_incident_read",
      action: "read",
      approvalRequired: true,
      description: "Search bounded Datadog incident summaries.",
      inputSchema: commonInput,
    },
    {
      name: "datadog.listServices",
      functionName: "datadog_list_services",
      aliases: ["datadog.listServices", "datadog_list_services"],
      capability: "service_read",
      platformCapability: "datadog_service_read",
      action: "read",
      approvalRequired: true,
      description: "List bounded Datadog service definitions.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "datadog_safe",
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
        "All three selected read-only tools run without Relay per-action approval while connection ownership, exact scopes, fixed requests, limits, redaction, audit, provider authority, and rate limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "monitor-search",
      label:
        "Datadog authorization, scopes, site, expiry, refresh, and bounded monitor search",
      requiredScopes: DATADOG_SCOPES,
    },
  ],
};
