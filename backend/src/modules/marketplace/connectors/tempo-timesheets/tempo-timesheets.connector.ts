import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("tempo_timesheets_worklog_list", "List worklogs", "List at most twenty-five Tempo worklogs in an explicit window no longer than ninety days."),
  action("tempo_timesheets_worklog_get", "Read a worklog", "Read one exact Tempo worklog visible to the connected token."),
  action("tempo_timesheets_account_list", "List accounts", "List at most twenty-five Tempo accounts visible to the connected token."),
  action("tempo_planner_plan_search", "Search plans", "Search at most twenty-five Tempo Planner resource allocations in an explicit window no longer than ninety days."),
];
const fullApi = [
  action("tempo_timesheets_full_api", "Use full Tempo API", "Use a documented Tempo API v4 operation authorized by the scoped token; Safe mode requires approval."),
];

export const TEMPO_TIMESHEETS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "tempo-timesheets",
  name: "Tempo Timesheets",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://apidocs.tempo.io/",
  providerWebsiteUrl: "https://www.tempo.io/products/tempo-timesheets",
  capabilities: [
    {
      ...capability("time_tracking_read", "Read time-tracking data", "Read bounded Tempo worklogs and account records from the connected Jira site.", true),
      platformCapability: "tempo_timesheets_read",
    },
    {
      ...capability("planning_read", "Read resource plans", "Read bounded Tempo Planner resource allocations from the same exact Jira site and scoped token.", true),
      platformCapability: "tempo_planner_read",
    },
    {
      ...capability("full_api", "Full Tempo API", "Use the documented Tempo API v4 surface allowed by the token's exact scopes and Tempo permissions.", true),
      platformCapability: "tempo_timesheets_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TEMPO_API_TOKEN",
        label: "Tempo API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Create a scoped token under Tempo Settings > Data Access > API Integration. Relay encrypts it and sends it only to Tempo's fixed API origin.",
      },
      {
        name: "TEMPO_JIRA_SITE_URL",
        label: "Jira Cloud site URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "Enter the exact https://<site>.atlassian.net site where this Tempo token was created so Relay can bind the connection to one tenant.",
      },
    ],
  },
  tools: [
    {
      name: "tempoTimesheets.listWorklogs",
      functionName: "tempo_timesheets_worklog_list",
      aliases: ["tempoTimesheets.listWorklogs", "tempo_timesheets_worklog_list"],
      capability: "time_tracking_read",
      platformCapability: "tempo_timesheets_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five worklogs in an explicit ISO-date window of up to ninety days.",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
    {
      name: "tempoTimesheets.getWorklog",
      functionName: "tempo_timesheets_worklog_get",
      aliases: ["tempoTimesheets.getWorklog", "tempo_timesheets_worklog_get"],
      capability: "time_tracking_read",
      platformCapability: "tempo_timesheets_read",
      action: "read",
      approvalRequired: false,
      description: "Read one exact Tempo worklog by numeric ID.",
      inputSchema: {
        type: "object",
        properties: { worklogId: { type: "string", pattern: "^[1-9][0-9]{0,18}$" } },
        required: ["worklogId"],
        additionalProperties: false,
      },
    },
    {
      name: "tempoTimesheets.listAccounts",
      functionName: "tempo_timesheets_account_list",
      aliases: ["tempoTimesheets.listAccounts", "tempo_timesheets_account_list"],
      capability: "time_tracking_read",
      platformCapability: "tempo_timesheets_read",
      action: "read",
      approvalRequired: false,
      description: "List at most twenty-five Tempo accounts visible to the connected token.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "tempoPlanner.searchPlans",
      functionName: "tempo_planner_plan_search",
      aliases: ["tempoPlanner.searchPlans", "tempo_planner_plan_search"],
      capability: "planning_read",
      platformCapability: "tempo_planner_read",
      action: "read",
      approvalRequired: false,
      description: "Search at most twenty-five Tempo Planner plans in an explicit ISO-date window of up to ninety days.",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
    {
      name: "tempoTimesheets.request",
      functionName: "tempo_timesheets_request",
      aliases: ["tempoTimesheets.request", "tempo_timesheets_request", "tempo_timesheets_full_api"],
      capability: "full_api",
      platformCapability: "tempo_timesheets_full_api",
      action: "admin",
      approvalRequired: true,
      description: "Call a documented Tempo API v4 method and relative path on the fixed Tempo origin; credential lifecycle routes are excluded.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          path: { type: "string", pattern: "^/" },
          query: { type: "object", maxProperties: 50 },
          json: { type: "object", maxProperties: 500 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "tempo_timesheets_safe",
      label: "Safe",
      description: "Bounded worklog and account reads run directly; every other Tempo API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: "Every selected token-authorized Tempo operation runs without Relay per-action approval; tenant binding, token scopes, fixed routing, bounds, audits, redaction and provider permissions still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [{ id: "worklogs", label: "Tempo token, scope and Jira-site binding" }],
};
