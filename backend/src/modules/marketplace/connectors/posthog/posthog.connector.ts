import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const POSTHOG_SCOPES = [
  "organization:read",
  "project:read",
  "dashboard:read",
  "insight:read",
  "query:read",
  "event_definition:read",
  "property_definition:read",
] as const;

const reads = [
  action(
    "posthog_projects_list",
    "List Projects",
    "List at most 25 Project/Environment summaries for the exact Organization and identify the selected Project.",
  ),
  action(
    "posthog_dashboards_list",
    "List Dashboards",
    "List at most 25 redacted Dashboard summaries for the selected Project.",
  ),
  action(
    "posthog_dashboard_read",
    "Read Dashboard",
    "Read one redacted Dashboard summary without tiles, Insight results, filters, or sharing configuration.",
  ),
  action(
    "posthog_insights_list",
    "List Insights",
    "List at most 25 redacted Insight summaries for the selected Project.",
  ),
  action(
    "posthog_insight_read",
    "Read Insight",
    "Read one redacted Insight summary without query filters, results, persons, or raw Event data.",
  ),
  action(
    "posthog_schema_read",
    "Read analytics schema",
    "List at most 25 redacted Event or Property Definition summaries for the selected Project.",
  ),
];
const boundedQuery = action(
  "posthog_query_bounded",
  "Run bounded Event trend",
  "Run one fixed daily total Trend for one exact Event over an explicit range of at most 31 days.",
);
const blockedActions = [
  blocked(
    "posthog_person_private",
    "Access persons or recordings",
    "Person/Group records, distinct IDs, properties, cohorts and membership, session recordings, replays, traces, logs, support conversations, and classified data are outside V1.",
  ),
  blocked(
    "posthog_raw_data",
    "Access raw analytics data",
    "Raw Events, properties/values, arbitrary HogQL/SQL, arbitrary queries, broad exports, Data Warehouse, detailed filters, and unbounded results are outside V1.",
  ),
  blocked(
    "posthog_mutation",
    "Change PostHog data",
    "Event capture and every Dashboard, Insight, Feature Flag, Experiment, Cohort, Annotation, Survey, Notebook, Pipeline, Subscription, Organization, Project, or other mutation are outside V1.",
  ),
  blocked(
    "posthog_broader_products",
    "Access broader PostHog products",
    "Feature Flags, Experiments, Session Replay, Error Tracking, Surveys, LLM Analytics, Revenue Analytics, Data Warehouse, CDP, Support, and administrative products are outside V1.",
  ),
  blocked(
    "posthog_raw_mcp",
    "Use raw PostHog MCP or API",
    "Raw hosted MCP tools, arbitrary origins/Organizations/Projects/paths/queries, pagination, crawling, synchronization, and raw REST access are outside V1.",
  ),
];
const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
const searchSchema = {
  type: "object",
  properties: { search: { type: "string", minLength: 1, maxLength: 100 } },
  additionalProperties: false,
};
const dashboardSchema = {
  type: "object",
  properties: {
    dashboardId: {
      type: "string",
      minLength: 1,
      maxLength: 128,
      pattern: "^[A-Za-z0-9_-]+$",
    },
  },
  required: ["dashboardId"],
  additionalProperties: false,
};
const insightSchema = {
  type: "object",
  properties: {
    insightId: {
      type: "string",
      minLength: 1,
      maxLength: 128,
      pattern: "^[A-Za-z0-9_-]+$",
    },
  },
  required: ["insightId"],
  additionalProperties: false,
};
const date = {
  type: "string",
  minLength: 10,
  maxLength: 10,
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
};
const trendSchema = {
  type: "object",
  properties: {
    event: { type: "string", minLength: 1, maxLength: 200 },
    fromDate: date,
    toDate: date,
  },
  required: ["event", "fromDate", "toDate"],
  additionalProperties: false,
};
const schemaSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["event", "property"] },
    search: { type: "string", minLength: 1, maxLength: 100 },
  },
  required: ["kind"],
  additionalProperties: false,
};

export const POSTHOG_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "posthog",
  name: "PostHog",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://posthog.com/docs/api",
  providerWebsiteUrl: "https://posthog.com/",
  capabilities: [
    {
      ...capability(
        "projects",
        "Projects",
        "Read bounded Organization Project/Environment summaries.",
        true,
      ),
      platformCapability: "posthog_project_read",
    },
    {
      ...capability(
        "dashboards",
        "Dashboards",
        "Read bounded redacted Dashboard summaries.",
        true,
      ),
      platformCapability: "posthog_dashboard_read",
    },
    {
      ...capability(
        "insights",
        "Insights",
        "Read bounded redacted Insight summaries.",
        true,
      ),
      platformCapability: "posthog_insight_read",
    },
    {
      ...capability(
        "bounded_query",
        "Bounded Event trend",
        "Run one fixed short daily Event-total Trend.",
        true,
      ),
      platformCapability: "posthog_query_read",
    },
    {
      ...capability(
        "schema",
        "Analytics schema",
        "Read bounded Event and Property Definition summaries.",
        true,
      ),
      platformCapability: "posthog_schema_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://oauth.posthog.com/oauth/authorize/",
      tokenUrl: "https://oauth.posthog.com/oauth/token/",
      refreshUrl: "https://oauth.posthog.com/oauth/token/",
      revocationUrl: "https://oauth.posthog.com/oauth/revoke/",
      userInfoUrl: "https://oauth.posthog.com/oauth/userinfo/",
      requiredScopes: [...POSTHOG_SCOPES],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "RELAY_POSTHOG_OAUTH_CLIENT_METADATA_URL",
        label: "Relay PostHog CIMD URL",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth2_authorization_code"],
        helpText:
          "Railway must contain the approved HTTPS Relay Client ID Metadata Document URL. The document identifies Relay and lists the exact Railway callback.",
      },
      {
        name: "POSTHOG_API_ORIGIN",
        label: "PostHog Cloud API origin",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth2_authorization_code"],
        helpText:
          "Select https://us.posthog.com or https://eu.posthog.com for the exact granted Project. Self-hosted and arbitrary origins are outside V1.",
      },
      {
        name: "POSTHOG_ORGANIZATION_ID",
        label: "PostHog Organization ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth2_authorization_code"],
        helpText:
          "Select the exact Organization authorized by the OAuth grant.",
      },
      {
        name: "POSTHOG_PROJECT_ID",
        label: "PostHog Project/Environment ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["oauth2_authorization_code"],
        helpText:
          "Select the exact numeric Project/Environment ID used by every Relay data tool.",
      },
    ],
  },
  tools: [
    {
      name: "posthog.listProjects",
      functionName: "posthog_projects_list",
      aliases: ["posthog.listProjects", "posthog_projects_list"],
      capability: "projects",
      platformCapability: "posthog_project_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 Project/Environment summaries for the exact Organization.",
      inputSchema: emptySchema,
    },
    {
      name: "posthog.listDashboards",
      functionName: "posthog_dashboards_list",
      aliases: ["posthog.listDashboards", "posthog_dashboards_list"],
      capability: "dashboards",
      platformCapability: "posthog_dashboard_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 redacted Dashboard summaries for the selected Project.",
      inputSchema: searchSchema,
    },
    {
      name: "posthog.getDashboard",
      functionName: "posthog_dashboard_read",
      aliases: ["posthog.getDashboard", "posthog_dashboard_read"],
      capability: "dashboards",
      platformCapability: "posthog_dashboard_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one redacted Dashboard summary without tile contents or results.",
      inputSchema: dashboardSchema,
    },
    {
      name: "posthog.listInsights",
      functionName: "posthog_insights_list",
      aliases: ["posthog.listInsights", "posthog_insights_list"],
      capability: "insights",
      platformCapability: "posthog_insight_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 redacted Insight summaries for the selected Project.",
      inputSchema: searchSchema,
    },
    {
      name: "posthog.getInsight",
      functionName: "posthog_insight_read",
      aliases: ["posthog.getInsight", "posthog_insight_read"],
      capability: "insights",
      platformCapability: "posthog_insight_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one redacted Insight summary without filters, results, or person data.",
      inputSchema: insightSchema,
    },
    {
      name: "posthog.runBoundedTrend",
      functionName: "posthog_query_bounded",
      aliases: ["posthog.runBoundedTrend", "posthog_query_bounded"],
      capability: "bounded_query",
      platformCapability: "posthog_query_read",
      action: "read",
      approvalRequired: true,
      description:
        "Run one fixed daily total Trend for one Event over at most 31 days; Safe mode requires approval.",
      inputSchema: trendSchema,
    },
    {
      name: "posthog.readSchema",
      functionName: "posthog_schema_read",
      aliases: ["posthog.readSchema", "posthog_schema_read"],
      capability: "schema",
      platformCapability: "posthog_schema_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most 25 redacted Event or Property Definition summaries.",
      inputSchema: schemaSchema,
    },
  ],
  approvalProfiles: [
    {
      id: "posthog_safe",
      label: "Safe",
      description:
        "Six bounded metadata/schema reads run automatically; the fixed Event trend requires approval, while persons, raw data, broader products, arbitrary access, MCP, exports, and writes stay blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [boundedQuery],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All seven curated read-only tools run without Relay per-action approval while exact region/Organization/Project binding, fixed requests, short ranges, audit, redaction, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, boundedQuery],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "project_grant",
      label:
        "PostHog OAuth scope, region, Organization, and Project validation",
      requiredScopes: [...POSTHOG_SCOPES],
    },
  ],
};
