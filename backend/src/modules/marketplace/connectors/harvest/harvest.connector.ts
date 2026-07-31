import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "harvest_project_assignment_list",
    "List project assignments",
    "List at most twenty-five active project assignments for the connected Harvest user.",
  ),
  action(
    "harvest_time_entry_list",
    "List time entries",
    "List at most twenty-five time entries for the connected Harvest user in an explicit window no longer than ninety days.",
  ),
  action(
    "harvest_time_entry_get",
    "Read a time entry",
    "Read one exact Harvest time entry visible to the connected user.",
  ),
];
const fullApi = [
  action(
    "harvest_full_api",
    "Use full Harvest API",
    "Use a documented Harvest API V2 operation authorized by the exact account grant; Safe mode requires approval.",
  ),
];

export const HARVEST_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "harvest",
  name: "Harvest",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://help.getharvest.com/api-v2/authentication-api/authentication/authentication/",
  providerWebsiteUrl: "https://www.getharvest.com/",
  capabilities: [
    {
      ...capability(
        "time_tracking_read",
        "Read time-tracking data",
        "Read bounded project-assignment and time-entry data from the connected Harvest account.",
        true,
      ),
      platformCapability: "harvest_time_tracking_read",
    },
    {
      ...capability(
        "full_api",
        "Full Harvest API",
        "Use the documented Harvest API V2 surface allowed by the exact account grant and authorizing user.",
        true,
      ),
      platformCapability: "harvest_full_api",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://id.getharvest.com/oauth2/authorize",
      tokenUrl: "https://id.getharvest.com/api/v2/oauth2/token",
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "harvest.listProjectAssignments",
      functionName: "harvest_project_assignment_list",
      aliases: [
        "harvest.listProjectAssignments",
        "harvest_project_assignment_list",
      ],
      capability: "time_tracking_read",
      platformCapability: "harvest_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five active project assignments for the connected Harvest user.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "harvest.listTimeEntries",
      functionName: "harvest_time_entry_list",
      aliases: ["harvest.listTimeEntries", "harvest_time_entry_list"],
      capability: "time_tracking_read",
      platformCapability: "harvest_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five time entries for the connected Harvest user in an explicit date window of up to ninety days.",
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
      name: "harvest.getTimeEntry",
      functionName: "harvest_time_entry_get",
      aliases: ["harvest.getTimeEntry", "harvest_time_entry_get"],
      capability: "time_tracking_read",
      platformCapability: "harvest_time_tracking_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one exact Harvest time entry by its positive integer ID.",
      inputSchema: {
        type: "object",
        properties: { timeEntryId: { type: "integer", minimum: 1 } },
        required: ["timeEntryId"],
        additionalProperties: false,
      },
    },
    {
      name: "harvest.request",
      functionName: "harvest_request",
      aliases: ["harvest.request", "harvest_request", "harvest_full_api"],
      capability: "full_api",
      platformCapability: "harvest_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Harvest API V2 method and relative path on the fixed API origin; OAuth, token and Harvest ID routes are excluded.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PATCH", "DELETE"],
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
      id: "harvest_safe",
      label: "Safe",
      description:
        "Bounded project-assignment and time-entry reads run directly; every other Harvest API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected account-authorized Harvest operation runs without Relay per-action approval; secret isolation, exact account binding, fixed routing, bounds, audits, provider permissions and Harvest limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "current-user",
      label: "Harvest account grant and authorizing user validation",
    },
  ],
};
