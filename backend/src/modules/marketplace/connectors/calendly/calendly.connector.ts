import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "calendly_event_type_list",
    "List active event types",
    "List at most twenty-five active Calendly Event Type summaries for the connected user.",
  ),
  action(
    "calendly_scheduled_event_list",
    "List upcoming scheduled events",
    "List at most twenty-five active Scheduled Event summaries for the connected user over the next fourteen days.",
  ),
  action(
    "calendly_scheduled_event_get",
    "Read a scheduled event",
    "Read one exact Calendly Scheduled Event summary without invitee or conferencing details.",
  ),
];

export const CALENDLY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "calendly",
  name: "Calendly",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.calendly.com/creating-an-oauth-app",
  providerWebsiteUrl: "https://calendly.com/",
  capabilities: [
    {
      ...capability(
        "scheduling_read",
        "Read scheduling metadata",
        "Read bounded Event Type and upcoming Scheduled Event summaries for the exact connected Calendly user.",
        true,
      ),
      platformCapability: "calendly_scheduling_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.calendly.com/oauth/authorize",
      tokenUrl: "https://auth.calendly.com/oauth/token",
      refreshUrl: "https://auth.calendly.com/oauth/token",
      userInfoUrl: "https://api.calendly.com/users/me",
      requiredScopes: [
        "users:read",
        "event_types:read",
        "scheduled_events:read",
      ],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "calendly.listEventTypes",
      functionName: "calendly_event_type_list",
      aliases: ["calendly.listEventTypes", "calendly_event_type_list"],
      capability: "scheduling_read",
      platformCapability: "calendly_scheduling_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five active Event Type summaries for the exact connected Calendly user.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "calendly.listScheduledEvents",
      functionName: "calendly_scheduled_event_list",
      aliases: [
        "calendly.listScheduledEvents",
        "calendly_scheduled_event_list",
      ],
      capability: "scheduling_read",
      platformCapability: "calendly_scheduling_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five active Scheduled Event summaries for the exact connected user over the next fourteen days.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "calendly.getScheduledEvent",
      functionName: "calendly_scheduled_event_get",
      aliases: ["calendly.getScheduledEvent", "calendly_scheduled_event_get"],
      capability: "scheduling_read",
      platformCapability: "calendly_scheduling_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact Calendly Scheduled Event summary without invitee identity, location, conferencing, notes or tracking details.",
      inputSchema: {
        type: "object",
        properties: {
          scheduledEventId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,64}$",
          },
        },
        required: ["scheduledEventId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "calendly_safe",
      label: "Safe",
      description:
        "Every bounded Calendly scheduling read requires approval; private invitee data, broader organization access and writes are outside Relay's V1 surface.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The three selected bounded Calendly reads run without Relay per-action approval; exact user binding, redaction, bounds, audits, provider scopes and Calendly limits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "current-user",
      label: "Calendly exact user and current organization validation",
      requiredScopes: [
        "users:read",
        "event_types:read",
        "scheduled_events:read",
      ],
    },
  ],
};
