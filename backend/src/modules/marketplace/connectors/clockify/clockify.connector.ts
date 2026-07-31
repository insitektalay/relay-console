import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "clockify_profile_get",
    "Read profile",
    "Read the connected Clockify user ID, name, timezone and active workspace.",
  ),
  action(
    "clockify_workspace_list",
    "List workspaces",
    "List at most twenty-five Clockify workspaces available to the connected user.",
  ),
  action(
    "clockify_project_list",
    "List projects",
    "List at most twenty-five active projects in one exact Clockify workspace.",
  ),
  action(
    "clockify_time_entry_list",
    "List time entries",
    "List at most twenty-five current-user time entries from an explicit window no longer than ninety days.",
  ),
];
const fullApi = [
  action(
    "clockify_full_api",
    "Use full Clockify API",
    "Use a documented Clockify regular or reports API operation authorized by the personal API key; Safe mode requires approval.",
  ),
];

export const CLOCKIFY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "clockify",
  name: "Clockify",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.clockify.me/",
  providerWebsiteUrl: "https://clockify.me/",
  capabilities: [
    {
      ...capability(
        "time_tracking_read",
        "Read time-tracking data",
        "Read bounded profile, workspace, project and current-user time-entry data from the connected Clockify account.",
        true,
      ),
      platformCapability: "clockify_time_tracking_read",
    },
    {
      ...capability(
        "full_api",
        "Full Clockify API",
        "Use the documented Clockify regular and reports API surfaces allowed by the connected user's personal API key.",
        true,
      ),
      platformCapability: "clockify_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CLOCKIFY_API_KEY",
        label: "Clockify API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the personal API key from Clockify Profile settings. Relay encrypts it and sends it only to the configured Clockify API origin in the documented X-Api-Key header.",
      },
      {
        name: "CLOCKIFY_API_BASE_URL",
        label: "Clockify API base URL",
        required: false,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Leave blank for https://api.clockify.me/api/v1. For a regional or subdomain workspace, paste its documented HTTPS /api/v1 base URL and generate a matching key in Clockify.",
      },
    ],
  },
  tools: [
    {
      name: "clockify.getProfile",
      functionName: "clockify_profile_get",
      aliases: ["clockify.getProfile", "clockify_profile_get"],
      capability: "time_tracking_read",
      platformCapability: "clockify_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description: "Read a bounded summary of the connected Clockify user.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "clockify.listWorkspaces",
      functionName: "clockify_workspace_list",
      aliases: ["clockify.listWorkspaces", "clockify_workspace_list"],
      capability: "time_tracking_read",
      platformCapability: "clockify_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five workspaces available to the connected Clockify user.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "clockify.listProjects",
      functionName: "clockify_project_list",
      aliases: ["clockify.listProjects", "clockify_project_list"],
      capability: "time_tracking_read",
      platformCapability: "clockify_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five active projects in one exact Clockify workspace.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["workspaceId"],
        additionalProperties: false,
      },
    },
    {
      name: "clockify.listTimeEntries",
      functionName: "clockify_time_entry_list",
      aliases: ["clockify.listTimeEntries", "clockify_time_entry_list"],
      capability: "time_tracking_read",
      platformCapability: "clockify_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five current-user time entries in an explicit RFC3339 window of up to ninety days.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["workspaceId", "startDate", "endDate"],
        additionalProperties: false,
      },
    },
    {
      name: "clockify.request",
      functionName: "clockify_request",
      aliases: ["clockify.request", "clockify_request", "clockify_full_api"],
      capability: "full_api",
      platformCapability: "clockify_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Clockify regular or reports API method and relative path on its validated fixed origin; credential lifecycle routes are excluded.",
      inputSchema: {
        type: "object",
        properties: {
          surface: { type: "string", enum: ["regular", "reports"] },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          path: { type: "string", pattern: "^/" },
          query: { type: "object", maxProperties: 50 },
          json: { type: "object", maxProperties: 500 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["surface", "method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "clockify_safe",
      label: "Safe",
      description:
        "Bounded profile, workspace, project and current-user time-entry reads run directly; every other Clockify API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected API-key-authorized Clockify operation runs without Relay per-action approval; secret isolation, fixed routing, bounds, audits, user authority and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "profile",
      label: "Clockify personal API key, origin and user validation",
    },
  ],
};
