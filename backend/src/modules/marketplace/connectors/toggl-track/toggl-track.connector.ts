import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "toggl_track_profile_get",
    "Read profile",
    "Read the connected Toggl Track user ID, name, timezone and workspace memberships.",
  ),
  action(
    "toggl_track_workspace_list",
    "List workspaces",
    "List at most twenty-five Toggl Track workspaces available to the connected user.",
  ),
  action(
    "toggl_track_project_list",
    "List projects",
    "List at most twenty-five projects in one exact Toggl Track workspace.",
  ),
  action(
    "toggl_track_time_entry_list",
    "List time entries",
    "List at most twenty-five time entries from an explicit window no longer than ninety days.",
  ),
];
const fullApi = [
  action(
    "toggl_track_full_api",
    "Use full Toggl Track API",
    "Use a documented Toggl Track API v9 operation authorized by the personal API token; Safe mode requires approval.",
  ),
];

export const TOGGL_TRACK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "toggl-track",
  name: "Toggl Track",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://engineering.toggl.com/docs/track/",
  providerWebsiteUrl: "https://toggl.com/track/",
  capabilities: [
    {
      ...capability(
        "time_tracking_read",
        "Read time-tracking data",
        "Read bounded profile, workspace, project and time-entry data from the connected Toggl Track account.",
        true,
      ),
      platformCapability: "toggl_track_time_tracking_read",
    },
    {
      ...capability(
        "full_api",
        "Full Toggl Track API",
        "Use the documented Track API v9 surface allowed by the connected user's personal token.",
        true,
      ),
      platformCapability: "toggl_track_full_api",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TOGGL_TRACK_API_TOKEN",
        label: "Toggl Track API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the personal API token from the user's Toggl Track profile. Relay encrypts it and sends it only to api.track.toggl.com using Toggl's documented token:api_token Basic authentication.",
      },
    ],
  },
  tools: [
    {
      name: "togglTrack.getProfile",
      functionName: "toggl_track_profile_get",
      aliases: ["togglTrack.getProfile", "toggl_track_profile_get"],
      capability: "time_tracking_read",
      platformCapability: "toggl_track_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description: "Read a bounded summary of the connected Toggl Track user.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "togglTrack.listWorkspaces",
      functionName: "toggl_track_workspace_list",
      aliases: ["togglTrack.listWorkspaces", "toggl_track_workspace_list"],
      capability: "time_tracking_read",
      platformCapability: "toggl_track_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five workspaces available to the connected Toggl Track user.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "togglTrack.listProjects",
      functionName: "toggl_track_project_list",
      aliases: ["togglTrack.listProjects", "toggl_track_project_list"],
      capability: "time_tracking_read",
      platformCapability: "toggl_track_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five projects in one exact Toggl Track workspace.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["workspaceId"],
        additionalProperties: false,
      },
    },
    {
      name: "togglTrack.listTimeEntries",
      functionName: "toggl_track_time_entry_list",
      aliases: ["togglTrack.listTimeEntries", "toggl_track_time_entry_list"],
      capability: "time_tracking_read",
      platformCapability: "toggl_track_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five time entries in an explicit RFC3339 window of up to ninety days.",
      inputSchema: {
        type: "object",
        properties: {
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["startDate", "endDate"],
        additionalProperties: false,
      },
    },
    {
      name: "togglTrack.request",
      functionName: "toggl_track_request",
      aliases: [
        "togglTrack.request",
        "toggl_track_request",
        "toggl_track_full_api",
      ],
      capability: "full_api",
      platformCapability: "toggl_track_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Track API v9 method and relative path on the fixed Toggl API origin; authentication and credential lifecycle routes are excluded.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
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
      id: "toggl_track_safe",
      label: "Safe",
      description:
        "Bounded profile, workspace, project and time-entry reads run directly; every other Track API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected token-authorized Track API operation runs without Relay per-action approval; secret isolation, fixed routing, bounds, audits, provider permissions and Toggl limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "profile",
      label: "Toggl Track personal API token and user validation",
    },
  ],
};
