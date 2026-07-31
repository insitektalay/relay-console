import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const PAGERDUTY_SCOPES = ["openid", "incidents.read", "services.read"];

const reads = [
  action(
    "pagerduty_incident_list",
    "List incidents",
    "List one bounded page of incident lifecycle summaries.",
  ),
  action(
    "pagerduty_incident_get",
    "Read incident",
    "Read one exact incident lifecycle summary.",
  ),
  action(
    "pagerduty_service_list",
    "List services",
    "List one bounded page of service ownership summaries.",
  ),
];

const blockedActions = [
  blocked(
    "pagerduty_incident_write",
    "Change incident state",
    "Acknowledging, resolving, reassigning, escalating, merging, adding notes, and other incident changes are outside V1.",
  ),
  blocked(
    "pagerduty_private_response_data",
    "Read private response data",
    "Contacts, users, schedules, on-calls, alert bodies, logs, notes, messages, and response content are outside V1.",
  ),
  blocked(
    "pagerduty_events_ingest",
    "Ingest events",
    "Events API ingestion, trigger, acknowledge, and resolve operations are outside V1.",
  ),
  blocked(
    "pagerduty_admin",
    "Administer PagerDuty",
    "Services, escalation policies, teams, integrations, webhooks, apps, keys, users, billing, and configuration changes are outside V1.",
  ),
  blocked(
    "pagerduty_raw_api",
    "Use raw PagerDuty API",
    "Arbitrary hosts, paths, queries, includes, cursors, pagination, bulk export, MCP, and raw responses are outside V1.",
  ),
];

const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const limit = { type: "integer", minimum: 1, maximum: 25 };

export const PAGERDUTY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "pagerduty",
  name: "PagerDuty",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.pagerduty.com/api-reference/",
  providerWebsiteUrl: "https://www.pagerduty.com/",
  capabilities: [
    {
      ...capability(
        "incident_read",
        "Read incidents",
        "List and inspect bounded incident lifecycle summaries.",
        true,
      ),
      platformCapability: "pagerduty_incident_read",
    },
    {
      ...capability(
        "service_read",
        "Read services",
        "List bounded service ownership summaries.",
        true,
      ),
      platformCapability: "pagerduty_service_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://identity.pagerduty.com/oauth/authorize",
      tokenUrl: "https://identity.pagerduty.com/oauth/token",
      refreshUrl: "https://identity.pagerduty.com/oauth/token",
      requiredScopes: PAGERDUTY_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "PAGERDUTY_CLIENT_ID",
        label: "PagerDuty Scoped OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Relay-owned confidential Scoped OAuth app client ID stored on Railway.",
      },
      {
        name: "PAGERDUTY_CLIENT_SECRET",
        label: "PagerDuty Scoped OAuth client secret",
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
      name: "pagerDuty.listIncidents",
      functionName: "pagerduty_incident_list",
      aliases: ["pagerDuty.listIncidents", "pagerduty_incident_list"],
      capability: "incident_read",
      platformCapability: "pagerduty_incident_read",
      action: "read",
      approvalRequired: true,
      description: "List one bounded PagerDuty incident page.",
      inputSchema: {
        type: "object",
        properties: {
          statuses: {
            type: "array",
            items: {
              type: "string",
              enum: ["triggered", "acknowledged", "resolved"],
            },
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
          },
          limit,
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "pagerDuty.getIncident",
      functionName: "pagerduty_incident_get",
      aliases: ["pagerDuty.getIncident", "pagerduty_incident_get"],
      capability: "incident_read",
      platformCapability: "pagerduty_incident_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact PagerDuty incident summary.",
      inputSchema: {
        type: "object",
        properties: {
          incidentId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,64}$",
          },
          approvalId,
        },
        required: ["incidentId"],
        additionalProperties: false,
      },
    },
    {
      name: "pagerDuty.listServices",
      functionName: "pagerduty_service_list",
      aliases: ["pagerDuty.listServices", "pagerduty_service_list"],
      capability: "service_read",
      platformCapability: "pagerduty_service_read",
      action: "read",
      approvalRequired: true,
      description: "List one bounded PagerDuty service page.",
      inputSchema: {
        type: "object",
        properties: { limit, approvalId },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "pagerduty_safe",
      label: "Safe",
      description:
        "All three bounded incident-response reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while account authority, exact scopes, fixed requests, limits, redaction, audit, and provider rate limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "service-list",
      label:
        "PagerDuty authorization, account audience, region, scopes, refresh, and bounded service read",
      requiredScopes: PAGERDUTY_SCOPES,
    },
  ],
};
