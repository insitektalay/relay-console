import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "smartsheet_sheet_list",
    "List sheets",
    "List at most twenty-five Smartsheet sheet summaries.",
  ),
  action(
    "smartsheet_sheet_get",
    "Read a sheet",
    "Read one Smartsheet sheet with at most twenty-five rows.",
  ),
  action(
    "smartsheet_row_get",
    "Read a row",
    "Read one row from an exact Smartsheet sheet.",
  ),
];
const fullApi = [
  action(
    "smartsheet_full_api",
    "Use full Smartsheet API",
    "Use any documented Smartsheet API 2.0 operation authorized by the connection; Safe mode requires approval.",
  ),
];

export const SMARTSHEET_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "smartsheet",
  name: "Smartsheet",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developers.smartsheet.com/api/smartsheet/guides/advanced-topics/oauth",
  providerWebsiteUrl: "https://www.smartsheet.com/",
  capabilities: [
    {
      ...capability(
        "sheet_read",
        "Read sheets",
        "Read bounded sheet and row data from the connected Smartsheet account.",
        true,
      ),
      platformCapability: "smartsheet_sheet_read",
    },
    {
      ...capability(
        "full_api",
        "Full Smartsheet API",
        "Use the complete documented Smartsheet API surface allowed by the connected user and account.",
        true,
      ),
      platformCapability: "smartsheet_full_api",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://app.smartsheet.com/b/authorize",
      tokenUrl: "https://api.smartsheet.com/2.0/token",
      requiredScopes: [
        "ADMIN_SHEETS",
        "ADMIN_SIGHTS",
        "ADMIN_USERS",
        "ADMIN_WEBHOOKS",
        "ADMIN_WORKSPACES",
        "CREATE_SHEETS",
        "CREATE_SIGHTS",
        "DELETE_SHEETS",
        "DELETE_SIGHTS",
        "READ_CONTACTS",
        "READ_EVENTS",
        "READ_SHEETS",
        "READ_SIGHTS",
        "READ_USERS",
        "SHARE_SHEETS",
        "SHARE_SIGHTS",
        "WRITE_SHEETS",
      ],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "smartsheet.listSheets",
      functionName: "smartsheet_sheet_list",
      aliases: ["smartsheet.listSheets", "smartsheet_sheet_list"],
      capability: "sheet_read",
      platformCapability: "smartsheet_sheet_read",
      action: "read",
      approvalRequired: false,
      description:
        "List at most twenty-five sheet summaries from the connected Smartsheet account.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
        additionalProperties: false,
      },
    },
    {
      name: "smartsheet.getSheet",
      functionName: "smartsheet_sheet_get",
      aliases: ["smartsheet.getSheet", "smartsheet_sheet_get"],
      capability: "sheet_read",
      platformCapability: "smartsheet_sheet_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read one sheet with at most twenty-five rows by numeric Smartsheet sheet ID.",
      inputSchema: {
        type: "object",
        properties: {
          sheetId: { type: "string", pattern: "^[1-9][0-9]{0,24}$" },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["sheetId"],
        additionalProperties: false,
      },
    },
    {
      name: "smartsheet.getRow",
      functionName: "smartsheet_row_get",
      aliases: ["smartsheet.getRow", "smartsheet_row_get"],
      capability: "sheet_read",
      platformCapability: "smartsheet_sheet_read",
      action: "read",
      approvalRequired: false,
      description: "Read one row by exact numeric sheet and row IDs.",
      inputSchema: {
        type: "object",
        properties: {
          sheetId: { type: "string", pattern: "^[1-9][0-9]{0,24}$" },
          rowId: { type: "string", pattern: "^[1-9][0-9]{0,24}$" },
        },
        required: ["sheetId", "rowId"],
        additionalProperties: false,
      },
    },
    {
      name: "smartsheet.request",
      functionName: "smartsheet_request",
      aliases: [
        "smartsheet.request",
        "smartsheet_request",
        "smartsheet_full_api",
      ],
      capability: "full_api",
      platformCapability: "smartsheet_full_api",
      action: "admin",
      approvalRequired: true,
      description:
        "Call a documented Smartsheet API 2.0 method and relative path on the exact bound API origin. Absolute URLs and credential-bearing fields are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          path: { type: "string", pattern: "^/" },
          query: { type: "object" },
          json: { type: "object" },
          approvalId: { type: "string" },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "smartsheet_safe",
      label: "Safe",
      description:
        "Bounded sheet and row reads run directly; every other Smartsheet API operation requires approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: fullApi,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Smartsheet operation runs without Relay per-action approval; account binding, secret isolation, request bounds, audits, Smartsheet permissions, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...fullApi],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "current-user",
      label: "Smartsheet exact account and authorizing-user validation",
    },
  ],
};
