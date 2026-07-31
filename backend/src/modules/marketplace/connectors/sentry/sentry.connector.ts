import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const SENTRY_SCOPES = [
  "org:read",
  "project:read",
  "event:read",
  "event:write",
] as const;

const reads = [
  action(
    "sentry_projects_list",
    "List Projects",
    "List at most 25 redacted Project summaries for the consented Organization.",
  ),
  action(
    "sentry_issues_search",
    "Search Issues",
    "Search at most 25 Issues with bounded project, environment, query, period, and sort filters.",
  ),
  action(
    "sentry_issue_read",
    "Read Issue",
    "Read one Issue with semantic workflow fields and a redacted latest Event summary.",
  ),
  action(
    "sentry_event_read",
    "Read Event",
    "Read one Event with bounded message, Exception, Tag, and Stacktrace summaries.",
  ),
  action(
    "sentry_issue_update_prepare",
    "Prepare Issue update",
    "Prepare one exact status, substatus, or priority update locally without changing Sentry.",
  ),
];
const write = action(
  "sentry_issue_update",
  "Update Issue workflow",
  "Apply one previously approved exact status, substatus, or priority update to one Issue.",
);
const blockedActions = [
  blocked(
    "sentry_sensitive_export",
    "Export sensitive telemetry",
    "Broad Issue/Event export, raw request/user/context/breadcrumb data, attachments, logs, profiles, replays, and source files are outside V1.",
  ),
  blocked(
    "sentry_bulk_destructive",
    "Bulk or delete Sentry data",
    "Bulk mutations and Issue, Event, snapshot, Project, or Organization deletion are outside V1.",
  ),
  blocked(
    "sentry_artifact_admin",
    "Change artifacts or administration",
    "Releases, deploys, source maps, files, alerts, integrations, hooks, teams, members, projects, and organization administration are outside V1.",
  ),
  blocked(
    "sentry_raw_mcp",
    "Use raw Sentry MCP or API",
    "Raw MCP, Seer/AI, arbitrary hosts, paths, queries, pagination, synchronization, and raw API access are outside V1.",
  ),
];

const empty = { type: "object", properties: {}, additionalProperties: false };
const issueId = {
  type: "object",
  properties: {
    issueId: { type: "string", pattern: "^[0-9]+$", maxLength: 128 },
  },
  required: ["issueId"],
  additionalProperties: false,
};
const updateProperties = {
  status: {
    type: "string",
    enum: [
      "resolved",
      "unresolved",
      "ignored",
      "resolvedInNextRelease",
      "muted",
    ],
  },
  substatus: {
    type: "string",
    enum: [
      "archived_until_escalating",
      "archived_until_condition_met",
      "archived_forever",
      "escalating",
    ],
  },
  priority: { type: "string", enum: ["high", "medium", "low"] },
};
const update = {
  type: "object",
  properties: {
    issueId: { type: "string", pattern: "^[0-9]+$", maxLength: 128 },
    ...updateProperties,
  },
  required: ["issueId"],
  anyOf: [
    { required: ["status"] },
    { required: ["substatus"] },
    { required: ["priority"] },
  ],
  additionalProperties: false,
};

export const SENTRY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sentry",
  name: "Sentry",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.sentry.io/api/",
  providerWebsiteUrl: "https://sentry.io/",
  capabilities: [
    {
      ...capability(
        "issue_triage",
        "Issue triage",
        "Read bounded Projects, Issues, and redacted Events.",
        true,
      ),
      platformCapability: "sentry_event_read",
    },
    {
      ...capability(
        "issue_workflow",
        "Issue workflow",
        "Prepare and approval-gate one exact Issue workflow update.",
        true,
      ),
      platformCapability: "sentry_event_write",
    },
  ],
  auth: {
    type: "custom",
    oauth: {
      authorizationUrl: "https://sentry.io/oauth/device/",
      tokenUrl: "https://sentry.io/oauth/token/",
      refreshUrl: "https://sentry.io/oauth/token/",
      requiredScopes: [...SENTRY_SCOPES],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "RELAY_SENTRY_OAUTH_CLIENT_ID",
        label: "Relay Sentry device OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["custom"],
        helpText:
          "Railway must contain the registered public Relay client ID; device OAuth uses no client secret or callback.",
      },
      {
        name: "SENTRY_ORGANIZATION",
        label: "Consented Sentry Organization",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["custom"],
        helpText:
          "The exact Organization selected during device consent and enforced by every wrapper.",
      },
    ],
  },
  tools: [
    {
      name: "sentry.listProjects",
      functionName: "sentry_projects_list",
      aliases: ["sentry.listProjects", "sentry_projects_list"],
      capability: "issue_triage",
      platformCapability: "sentry_event_read",
      action: "read",
      approvalRequired: false,
      description: reads[0].description,
      inputSchema: empty,
    },
    {
      name: "sentry.searchIssues",
      functionName: "sentry_issues_search",
      aliases: ["sentry.searchIssues", "sentry_issues_search"],
      capability: "issue_triage",
      platformCapability: "sentry_event_read",
      action: "read",
      approvalRequired: false,
      description: reads[1].description,
      inputSchema: {
        type: "object",
        properties: {
          project: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]+$",
            maxLength: 128,
          },
          environment: { type: "string", minLength: 1, maxLength: 100 },
          query: { type: "string", minLength: 1, maxLength: 200 },
          statsPeriod: { type: "string", enum: ["24h", "7d", "14d"] },
          sort: { type: "string", enum: ["date", "new", "freq", "user"] },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "sentry.getIssue",
      functionName: "sentry_issue_read",
      aliases: ["sentry.getIssue", "sentry_issue_read"],
      capability: "issue_triage",
      platformCapability: "sentry_event_read",
      action: "read",
      approvalRequired: false,
      description: reads[2].description,
      inputSchema: issueId,
    },
    {
      name: "sentry.getEvent",
      functionName: "sentry_event_read",
      aliases: ["sentry.getEvent", "sentry_event_read"],
      capability: "issue_triage",
      platformCapability: "sentry_event_read",
      action: "read",
      approvalRequired: false,
      description: reads[3].description,
      inputSchema: {
        type: "object",
        properties: {
          projectSlug: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]+$",
            maxLength: 128,
          },
          eventId: {
            type: "string",
            pattern: "^[A-Fa-f0-9-]+$",
            maxLength: 128,
          },
        },
        required: ["projectSlug", "eventId"],
        additionalProperties: false,
      },
    },
    {
      name: "sentry.prepareIssueUpdate",
      functionName: "sentry_issue_update_prepare",
      aliases: ["sentry.prepareIssueUpdate", "sentry_issue_update_prepare"],
      capability: "issue_workflow",
      platformCapability: "sentry_event_write",
      action: "draft",
      approvalRequired: false,
      description: reads[4].description,
      inputSchema: update,
    },
    {
      name: "sentry.updateIssue",
      functionName: "sentry_issue_update",
      aliases: ["sentry.updateIssue", "sentry_issue_update"],
      capability: "issue_workflow",
      platformCapability: "sentry_event_write",
      action: "write",
      approvalRequired: true,
      description: write.description,
      inputSchema: update,
    },
  ],
  approvalProfiles: [
    {
      id: "sentry_safe",
      label: "Safe",
      description:
        "Four bounded reads and local update preparation run automatically; an exact Issue workflow update requires Relay approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [write],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "The same six curated wrappers run without per-action approval; bulk, destructive, sensitive, admin, arbitrary, and raw MCP access remain blocked.",
      defaultSelected: false,
      allowedActions: [...reads, write],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "sentry_device_oauth_organization",
      label: "Verify device OAuth and Organization-bound Project access",
      requiredScopes: [...SENTRY_SCOPES],
    },
  ],
};
