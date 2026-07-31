import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "coda_doc_list",
    "List docs",
    "List one bounded page of docs visible to the connected Coda user.",
  ),
  action("coda_doc_get", "Read doc", "Read metadata for one explicit doc."),
  action(
    "coda_page_list",
    "List pages",
    "List one bounded page of pages in an explicit doc.",
  ),
  action(
    "coda_table_list",
    "List tables",
    "List one bounded page of tables and views in an explicit doc.",
  ),
  action(
    "coda_row_list",
    "List rows",
    "List one bounded first page of rows from an explicit table or view.",
  ),
  action(
    "coda_row_get",
    "Read row",
    "Read one explicit row from an explicit table or view.",
  ),
  action(
    "coda_mutation_status",
    "Check change status",
    "Check one recent Coda asynchronous mutation request.",
  ),
  action(
    "coda_row_prepare",
    "Prepare row change",
    "Prepare and hash one row insert or update locally without changing Coda.",
  ),
];
const writes = [
  action(
    "coda_row_insert",
    "Insert row",
    "Insert one row into an explicit base table; Safe mode requires approval.",
  ),
  action(
    "coda_row_update",
    "Update row",
    "Update bounded cells on one explicit row; Safe mode requires approval.",
  ),
];
const blockedActions = [
  blocked(
    "coda_destructive",
    "Delete Coda content",
    "Deleting docs, pages, page content, rows, or permissions is outside V1.",
  ),
  blocked(
    "coda_admin",
    "Change sharing or structure",
    "Creating docs, pages, folders, permissions, publishing, schema, formulas, controls, automations, and webhooks is outside V1.",
  ),
  blocked(
    "coda_unbounded",
    "Run broad or raw API requests",
    "Automatic pagination, bulk writes, upserts, exports, analytics, agent-supplied row queries, and arbitrary API requests are outside V1.",
  ),
];

export const CODA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "coda",
  name: "Coda",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://coda.io/developers/apis/v1",
  providerWebsiteUrl: "https://coda.io/",
  capabilities: [
    {
      ...capability(
        "doc_read",
        "Find docs and pages",
        "List authorized docs and inspect explicit doc and page metadata.",
        true,
      ),
      platformCapability: "coda_doc_read",
    },
    {
      ...capability(
        "table_read",
        "Read tables and rows",
        "Inspect table structure and read bounded rows from explicit tables or views.",
        true,
      ),
      platformCapability: "coda_table_read",
    },
    {
      ...capability(
        "row_draft",
        "Prepare row changes",
        "Prepare exact single-row inserts or updates locally before execution.",
        true,
      ),
      platformCapability: "coda_row_draft",
    },
    {
      ...capability(
        "row_write",
        "Insert and update rows",
        "Insert one row or update bounded cells on one explicit row.",
        true,
      ),
      platformCapability: "coda_row_write",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CODA_API_TOKEN",
        label: "Coda API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a personal API token in Coda account settings with only the access you want Relay to use.",
      },
    ],
  },
  tools: [
    tool(
      "coda.listDocs",
      "coda_list_docs",
      "doc_read",
      "read",
      false,
      "List at most twenty-five docs visible to the token owner.",
      { maxResults: integer(1, 25) },
    ),
    tool(
      "coda.getDoc",
      "coda_get_doc",
      "doc_read",
      "read",
      false,
      "Read metadata for one explicit doc.",
      { docId: id() },
      ["docId"],
    ),
    tool(
      "coda.listPages",
      "coda_list_pages",
      "doc_read",
      "read",
      false,
      "List at most fifty pages in one explicit doc.",
      { docId: id(), maxResults: integer(1, 50) },
      ["docId"],
    ),
    tool(
      "coda.listTables",
      "coda_list_tables",
      "table_read",
      "read",
      false,
      "List at most fifty tables and views in one explicit doc.",
      { docId: id(), maxResults: integer(1, 50) },
      ["docId"],
    ),
    tool(
      "coda.listRows",
      "coda_list_rows",
      "table_read",
      "read",
      false,
      "List at most fifty rows from the first page of one explicit table or view.",
      { docId: id(), tableId: id(), maxResults: integer(1, 50) },
      ["docId", "tableId"],
    ),
    tool(
      "coda.getRow",
      "coda_get_row",
      "table_read",
      "read",
      false,
      "Read one explicit row.",
      { docId: id(), tableId: id(), rowId: id() },
      ["docId", "tableId", "rowId"],
    ),
    tool(
      "coda.getMutationStatus",
      "coda_get_mutation_status",
      "doc_read",
      "read",
      false,
      "Check one recent asynchronous Coda mutation request.",
      { requestId: id() },
      ["requestId"],
    ),
    tool(
      "coda.draftRowChange",
      "coda_draft_row_change",
      "row_draft",
      "draft",
      false,
      "Prepare one bounded row insert or update locally.",
      {
        operation: { type: "string", enum: ["insert", "update"] },
        docId: id(),
        tableId: id(),
        rowId: id(false),
        cells: cells(),
      },
      ["operation", "docId", "tableId", "cells"],
    ),
    tool(
      "coda.insertRow",
      "coda_insert_row",
      "row_write",
      "write",
      true,
      "Insert one row into an explicit base table.",
      {
        docId: id(),
        tableId: id(),
        cells: cells(),
        disableParsing: { type: "boolean" },
        approvalId: id(),
        idempotencyKey: id(),
      },
      ["docId", "tableId", "cells", "approvalId", "idempotencyKey"],
    ),
    tool(
      "coda.updateRow",
      "coda_update_row",
      "row_write",
      "write",
      true,
      "Update bounded cells on one explicit row.",
      {
        docId: id(),
        tableId: id(),
        rowId: id(),
        cells: cells(),
        disableParsing: { type: "boolean" },
        approvalId: id(),
        idempotencyKey: id(),
      },
      ["docId", "tableId", "rowId", "cells", "approvalId", "idempotencyKey"],
    ),
  ],
  approvalProfiles: [
    {
      id: "coda_safe",
      label: "Safe",
      description:
        "Bounded reads and local drafts run directly; each Coda row write requires matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Coda operation supported by this connector runs without Relay per-action approval; connection ownership, token scope, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [{ id: "whoami", label: "Coda user and API-token validation" }],
};

function tool(
  name: string,
  alias: string,
  capabilityId: string,
  actionName: "read" | "draft" | "write",
  approvalRequired: boolean,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) {
  return {
    name,
    functionName: alias,
    aliases: [name, alias],
    capability: capabilityId,
    platformCapability: `coda_${capabilityId}`,
    action: actionName,
    approvalRequired,
    description,
    inputSchema: {
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    },
  };
}
function id(required = true) {
  return {
    type: "string",
    ...(required ? { minLength: 1 } : {}),
    maxLength: 180,
  };
}
function integer(minimum: number, maximum: number) {
  return { type: "integer", minimum, maximum };
}
function cells() {
  return {
    type: "array",
    minItems: 1,
    maxItems: 50,
    items: {
      type: "object",
      properties: { column: id(), value: {} },
      required: ["column", "value"],
      additionalProperties: false,
    },
  };
}
