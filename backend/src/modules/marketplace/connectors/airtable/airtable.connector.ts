import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "airtable_base_list",
    "List bases",
    "List a bounded set of bases included in the OAuth resource grant.",
  ),
  action(
    "airtable_base_schema_get",
    "Read base schema",
    "Read bounded table, field, and view metadata for one base.",
  ),
  action(
    "airtable_table_records",
    "List records",
    "List a bounded first page of records from one table.",
  ),
  action("airtable_record_get", "Read a record", "Read one explicit record."),
  action(
    "airtable_record_comments",
    "List comments",
    "List bounded comments for one explicit record.",
  ),
  action(
    "airtable_record_prepare",
    "Prepare a record change",
    "Prepare and hash one record create, update, or comment locally.",
  ),
];
const writes = [
  action(
    "airtable_record_create",
    "Create a record",
    "Create one record in an explicit table.",
  ),
  action(
    "airtable_record_update",
    "Update a record",
    "Patch bounded fields on one explicit record.",
  ),
  action(
    "airtable_record_comment_create",
    "Add a comment",
    "Add one bounded comment to an explicit record.",
  ),
];
const blockedActions = [
  blocked(
    "airtable_schema_admin",
    "Change base structure",
    "Creating or changing bases, tables, fields, views, collaborators, shares, interfaces, and extensions is outside V1.",
  ),
  blocked(
    "airtable_destructive",
    "Delete or bulk-change data",
    "Deletion, upsert, bulk writes, webhooks, broad exports, and automatic pagination are outside V1.",
  ),
  blocked(
    "airtable_raw_api",
    "Call arbitrary Airtable APIs",
    "Raw REST, formulas supplied by agents, Sync API, Enterprise APIs, and untyped endpoints are never exposed.",
  ),
];

export const AIRTABLE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "airtable",
  name: "Airtable",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://airtable.com/developers/web/api/introduction",
  providerWebsiteUrl: "https://airtable.com/",
  capabilities: [
    {
      ...capability(
        "base_read",
        "View bases and structure",
        "List authorized bases and inspect useful table, field, and view structure.",
        true,
      ),
      platformCapability: "airtable_base_read",
    },
    {
      ...capability(
        "record_read",
        "Find and read records",
        "List bounded records and read explicit records and comments.",
        true,
      ),
      platformCapability: "airtable_record_read",
    },
    {
      ...capability(
        "record_draft",
        "Prepare record changes",
        "Prepare exact record creates, updates, or comments locally.",
        true,
      ),
      platformCapability: "airtable_record_draft",
    },
    {
      ...capability(
        "record_write",
        "Create and update records",
        "Create records, patch fields, and add record comments.",
        true,
      ),
      platformCapability: "airtable_record_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://airtable.com/oauth2/v1/authorize",
      tokenUrl: "https://airtable.com/oauth2/v1/token",
      refreshUrl: "https://airtable.com/oauth2/v1/token",
      requiredScopes: [
        "schema.bases:read",
        "data.records:read",
        "data.records:write",
        "data.recordComments:read",
        "data.recordComments:write",
        "user.email:read",
      ],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "AIRTABLE_CLIENT_ID",
        label: "Airtable OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Railway-held Relay Console Airtable integration client ID.",
      },
      {
        name: "AIRTABLE_CLIENT_SECRET",
        label: "Airtable OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Airtable client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    tool(
      "relay_airtable_list_bases",
      "airtable_base_list",
      "base_read",
      "read",
      false,
      "List at most twenty-five authorized Airtable bases.",
      { maxResults: integer(1, 25) },
    ),
    tool(
      "relay_airtable_get_base_schema",
      "airtable_base_schema_get",
      "base_read",
      "read",
      false,
      "Read bounded structure for one authorized base.",
      { baseId: id(), maxTables: integer(1, 25) },
      ["baseId"],
    ),
    tool(
      "relay_airtable_list_records",
      "airtable_table_records",
      "record_read",
      "read",
      false,
      "List at most fifty records from the first page of one table.",
      {
        baseId: id(),
        tableId: id(),
        viewId: id(false),
        maxResults: integer(1, 50),
      },
      ["baseId", "tableId"],
    ),
    tool(
      "relay_airtable_get_record",
      "airtable_record_get",
      "record_read",
      "read",
      false,
      "Read one explicit record.",
      { baseId: id(), tableId: id(), recordId: id() },
      ["baseId", "tableId", "recordId"],
    ),
    tool(
      "relay_airtable_list_record_comments",
      "airtable_record_comments",
      "record_read",
      "read",
      false,
      "List at most twenty-five comments for one record.",
      {
        baseId: id(),
        tableId: id(),
        recordId: id(),
        maxResults: integer(1, 25),
        maxTextChars: integer(1, 4000),
      },
      ["baseId", "tableId", "recordId"],
    ),
    tool(
      "relay_airtable_draft_record_change",
      "airtable_record_prepare",
      "record_draft",
      "draft",
      false,
      "Prepare one bounded record create, update, or comment locally.",
      {
        operation: { type: "string", enum: ["create", "update", "comment"] },
        baseId: id(),
        tableId: id(),
        recordId: id(false),
        fields: { type: "object" },
        comment: { type: "string", maxLength: 8000 },
      },
      ["operation", "baseId", "tableId"],
    ),
    tool(
      "relay_airtable_create_record",
      "airtable_record_create",
      "record_write",
      "write",
      true,
      "Create one record in an explicit table.",
      {
        baseId: id(),
        tableId: id(),
        fields: { type: "object" },
        typecast: { type: "boolean" },
        approvalId: id(),
        idempotencyKey: id(),
      },
      ["baseId", "tableId", "fields", "approvalId", "idempotencyKey"],
    ),
    tool(
      "relay_airtable_update_record",
      "airtable_record_update",
      "record_write",
      "write",
      true,
      "Patch bounded fields on one explicit record.",
      {
        baseId: id(),
        tableId: id(),
        recordId: id(),
        fields: { type: "object" },
        typecast: { type: "boolean" },
        approvalId: id(),
        idempotencyKey: id(),
      },
      [
        "baseId",
        "tableId",
        "recordId",
        "fields",
        "approvalId",
        "idempotencyKey",
      ],
    ),
    tool(
      "relay_airtable_add_record_comment",
      "airtable_record_comment_create",
      "record_write",
      "write",
      true,
      "Add one bounded comment to an explicit record.",
      {
        baseId: id(),
        tableId: id(),
        recordId: id(),
        comment: { type: "string", minLength: 1, maxLength: 8000 },
        parentCommentId: id(false),
        approvalId: id(),
        idempotencyKey: id(),
      },
      [
        "baseId",
        "tableId",
        "recordId",
        "comment",
        "approvalId",
        "idempotencyKey",
      ],
    ),
  ],
  approvalProfiles: [
    {
      id: "airtable_safe",
      label: "Safe",
      description:
        "Bounded reads and local drafts run directly; each Airtable write requires matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Airtable operation supported by this connector runs without Relay per-action approval; connection ownership, resource grants, bounds, audits, redaction, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    { id: "identity", label: "Connected user and granted scopes" },
    {
      id: "bases",
      label: "Authorized bases",
      requiredScopes: ["schema.bases:read"],
    },
  ],
};

function tool(
  name: string,
  alias: string,
  capability: string,
  actionName: "read" | "draft" | "write",
  approvalRequired: boolean,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) {
  return {
    name,
    functionName: name,
    aliases: [alias],
    capability,
    platformCapability: `airtable_${capability}`,
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
