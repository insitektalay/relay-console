import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_SHEETS_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
];

const reads = [
  action(
    "google_sheets_spreadsheet_get",
    "Read spreadsheet metadata",
    "Read bounded metadata for one explicit app-visible spreadsheet.",
  ),
  action(
    "google_sheets_values_get",
    "Read spreadsheet values",
    "Read at most 5,000 cells from one explicit A1 range.",
  ),
  action(
    "google_sheets_values_prepare",
    "Prepare spreadsheet values",
    "Validate and hash one bounded update or append locally.",
  ),
];
const writes = [
  action(
    "google_sheets_values_update",
    "Update spreadsheet values",
    "Update one explicit bounded A1 range.",
  ),
  action(
    "google_sheets_values_append",
    "Append spreadsheet values",
    "Append bounded rows to one explicit logical-table range.",
  ),
];
const blockedActions = [
  blocked(
    "google_sheets_discovery",
    "Discover spreadsheets",
    "Whole-Drive listing, search, shared-drive crawling, and automatic pagination are outside V1.",
  ),
  blocked(
    "google_sheets_structure",
    "Clear or change spreadsheet structure",
    "Clear, add, delete, copy, move, resize, or rename sheet operations are outside V1.",
  ),
  blocked(
    "google_sheets_advanced",
    "Change formatting or advanced objects",
    "Formatting, charts, pivots, filters, protected ranges, named ranges, and external data are outside V1.",
  ),
  blocked(
    "google_sheets_external_raw",
    "Share, export, script, or run raw operations",
    "Permissions, sharing, export, macros, Apps Script, domain delegation, and raw API or MCP access are outside V1.",
  ),
];

const identifier = {
  type: "string",
  minLength: 1,
  maxLength: 200,
  pattern: "^[A-Za-z0-9_-]+$",
};
const range = { type: "string", minLength: 1, maxLength: 500 };
const values = { type: "array", minItems: 1, maxItems: 200 };
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const idempotencyKey = { type: "string", minLength: 8, maxLength: 200 };

export const GOOGLE_SHEETS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-sheets",
  name: "Google Sheets",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.google.com/workspace/sheets/api/scopes",
  providerWebsiteUrl: "https://workspace.google.com/products/sheets/",
  capabilities: [
    {
      ...capability(
        "spreadsheet_read",
        "Read spreadsheets",
        "Read metadata and bounded values from explicit app-visible spreadsheets.",
        true,
      ),
      platformCapability: "google_sheets_spreadsheet_read",
    },
    {
      ...capability(
        "spreadsheet_draft",
        "Prepare values",
        "Validate and hash bounded value changes locally.",
        true,
      ),
      platformCapability: "google_sheets_spreadsheet_draft",
    },
    {
      ...capability(
        "spreadsheet_write",
        "Update and append values",
        "Update explicit ranges or append bounded rows after policy checks.",
        true,
      ),
      platformCapability: "google_sheets_spreadsheet_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_SHEETS_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GOOGLE_OAUTH_CLIENT_ID",
        label: "Google OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console confidential web OAuth client ID.",
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Google OAuth client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "googleSheets.getSpreadsheet",
      functionName: "google_sheets_spreadsheet_get",
      aliases: ["google_sheets_spreadsheet_get"],
      capability: "spreadsheet_read",
      platformCapability: "google_sheets_spreadsheet_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read metadata for one exact app-visible spreadsheet without grid data.",
      inputSchema: {
        type: "object",
        properties: { spreadsheetId: identifier },
        required: ["spreadsheetId"],
        additionalProperties: false,
      },
    },
    {
      name: "googleSheets.getValues",
      functionName: "google_sheets_values_get",
      aliases: ["google_sheets_values_get"],
      capability: "spreadsheet_read",
      platformCapability: "google_sheets_spreadsheet_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most 5,000 scalar cells from one explicit A1 range.",
      inputSchema: {
        type: "object",
        properties: { spreadsheetId: identifier, range },
        required: ["spreadsheetId", "range"],
        additionalProperties: false,
      },
    },
    {
      name: "googleSheets.prepareValues",
      functionName: "google_sheets_values_prepare",
      aliases: ["google_sheets_values_prepare"],
      capability: "spreadsheet_draft",
      platformCapability: "google_sheets_spreadsheet_draft",
      action: "draft",
      approvalRequired: false,
      description: "Validate and hash one bounded update or append locally.",
      inputSchema: {
        type: "object",
        properties: {
          spreadsheetId: identifier,
          range,
          operation: { type: "string", enum: ["update", "append"] },
          values,
          valueInputOption: { type: "string", enum: ["RAW", "USER_ENTERED"] },
        },
        required: ["spreadsheetId", "range", "operation", "values"],
        additionalProperties: false,
      },
    },
    {
      name: "googleSheets.updateValues",
      functionName: "google_sheets_values_update",
      aliases: ["google_sheets_values_update"],
      capability: "spreadsheet_write",
      platformCapability: "google_sheets_spreadsheet_write",
      action: "write",
      approvalRequired: true,
      description:
        "Update one explicit bounded A1 range after approval checks.",
      inputSchema: {
        type: "object",
        properties: {
          spreadsheetId: identifier,
          range,
          values,
          valueInputOption: { type: "string", enum: ["RAW", "USER_ENTERED"] },
          approvalId,
          idempotencyKey,
        },
        required: [
          "spreadsheetId",
          "range",
          "values",
          "approvalId",
          "idempotencyKey",
        ],
        additionalProperties: false,
      },
    },
    {
      name: "googleSheets.appendValues",
      functionName: "google_sheets_values_append",
      aliases: ["google_sheets_values_append"],
      capability: "spreadsheet_write",
      platformCapability: "google_sheets_spreadsheet_write",
      action: "write",
      approvalRequired: true,
      description:
        "Append bounded rows to one explicit logical-table range after approval checks.",
      inputSchema: {
        type: "object",
        properties: {
          spreadsheetId: identifier,
          range,
          values,
          valueInputOption: { type: "string", enum: ["RAW", "USER_ENTERED"] },
          approvalId,
          idempotencyKey,
        },
        required: [
          "spreadsheetId",
          "range",
          "values",
          "approvalId",
          "idempotencyKey",
        ],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "google_sheets_safe",
      label: "Safe",
      description:
        "Bounded exact-spreadsheet reads and local preparation run automatically; updates and appends require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All five selected tools run without Relay per-action approval while drive.file, explicit IDs and ranges, account binding, value limits, audit, redaction, refresh, revocation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "app-visible-spreadsheets",
      label:
        "Google account, exact drive.file scope, refresh lifecycle, and app-visible spreadsheet access",
      requiredScopes: GOOGLE_SHEETS_SCOPES,
    },
  ],
};
