import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "workfront_planning_workspaces_list",
    "List workspaces",
    "List at most twenty bounded Workfront Planning workspace summaries.",
  ),
  action(
    "workfront_planning_workspace_get",
    "Read workspace",
    "Read bounded metadata for one exact Planning workspace.",
  ),
  action(
    "workfront_planning_record_types_list",
    "List record types",
    "List at most twenty bounded record-type summaries in one exact workspace.",
  ),
  action(
    "workfront_planning_record_type_get",
    "Read record type",
    "Read bounded metadata for one exact Planning record type.",
  ),
];
const blockedActions = [
  blocked(
    "workfront_planning_records",
    "Access Planning records",
    "Record values, searches, history, thumbnails, external references and comments are unavailable.",
  ),
  blocked(
    "workfront_planning_schema_admin",
    "Change Planning schemas",
    "Workspace, record-type, field and view creation, update, deletion, detachment or reordering are unavailable.",
  ),
  blocked(
    "workfront_planning_permissions_people",
    "Access permissions or people",
    "Members, permission lists, inheritance, access requests, identities and acting-user impersonation are unavailable.",
  ),
  blocked(
    "workfront_planning_bulk_mutation",
    "Run bulk operations",
    "Bulk record creation, update, patch, deletion and movement are unavailable.",
  ),
  blocked(
    "workfront_planning_other_apis",
    "Use other Workfront APIs",
    "Workflow, Fusion, commenting, Review and Approvals, event subscriptions, session authentication and API keys are outside this connection.",
  ),
  blocked(
    "workfront_planning_v1_raw",
    "Use V1 or arbitrary API calls",
    "Version 1, caller-selected origins, paths, headers, cursors, filters, projections and raw requests are unavailable.",
  ),
  blocked(
    "workfront_planning_unbounded_export",
    "Run unbounded reads or exports",
    "Caller cursors, recursive discovery, exports and responses above twenty rows or 256 KiB are unavailable.",
  ),
];
const id = {
  type: "string",
  pattern: "^[A-Za-z0-9_-]{1,64}$",
  minLength: 1,
  maxLength: 64,
};
const limit = { type: "integer", minimum: 1, maximum: 20, default: 10 };
const approvalId = { type: "string", maxLength: 200 };

export const WORKFRONT_PLANNING_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "workfront-planning",
  name: "Adobe Workfront Planning",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.adobe.com/wf-planning/",
  providerWebsiteUrl:
    "https://business.adobe.com/products/workfront/planning.html",
  capabilities: [
    {
      ...capability(
        "workspace_read",
        "Read workspaces",
        "List bounded workspaces and inspect one exact workspace.",
        true,
      ),
      platformCapability: "workfront_planning_workspace_read",
    },
    {
      ...capability(
        "record_type_read",
        "Read record types",
        "List bounded record types and inspect one exact schema summary.",
        true,
      ),
      platformCapability: "workfront_planning_record_type_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "WORKFRONT_PLANNING_CLIENT_ID",
        label: "Adobe IMS client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "The OAuth server-to-server client ID from Adobe Developer Console.",
      },
      {
        name: "WORKFRONT_PLANNING_CLIENT_SECRET",
        label: "Adobe IMS client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText: "The current client secret for the dedicated Workfront technical account credential.",
      },
      {
        name: "WORKFRONT_PLANNING_IMS_ORG_ID",
        label: "Adobe IMS organization ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "The exact IMS organization ID sent in x-gw-ims-org-id.",
      },
      {
        name: "WORKFRONT_PLANNING_SCOPE",
        label: "Adobe IMS scope list",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "The comma-separated Workfront scopes shown on this server-to-server credential.",
      },
      {
        name: "WORKFRONT_PLANNING_CUSTOMER_HOSTNAME",
        label: "Workfront customer hostname",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText: "The exact tenant hostname, such as example.my.workfront.com.",
      },
    ],
  },
  tools: [
    {
      name: "workfrontPlanning.listWorkspaces",
      functionName: "workfront_planning_workspaces_list",
      aliases: ["workfrontPlanning.listWorkspaces", "workfront_planning_workspaces_list"],
      description: "List bounded Workfront Planning workspace summaries.",
      capability: "workspace_read",
      platformCapability: "workfront_planning_workspace_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { limit, approvalId },
      },
    },
    {
      name: "workfrontPlanning.getWorkspace",
      functionName: "workfront_planning_workspace_get",
      aliases: ["workfrontPlanning.getWorkspace", "workfront_planning_workspace_get"],
      description: "Read bounded metadata for one exact Planning workspace.",
      capability: "workspace_read",
      platformCapability: "workfront_planning_workspace_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId"],
        properties: { workspaceId: id, approvalId },
      },
    },
    {
      name: "workfrontPlanning.listRecordTypes",
      functionName: "workfront_planning_record_types_list",
      aliases: ["workfrontPlanning.listRecordTypes", "workfront_planning_record_types_list"],
      description: "List bounded record-type summaries in one exact workspace.",
      capability: "record_type_read",
      platformCapability: "workfront_planning_record_type_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["workspaceId"],
        properties: { workspaceId: id, limit, approvalId },
      },
    },
    {
      name: "workfrontPlanning.getRecordType",
      functionName: "workfront_planning_record_type_get",
      aliases: ["workfrontPlanning.getRecordType", "workfront_planning_record_type_get"],
      description: "Read bounded metadata for one exact Planning record type.",
      capability: "record_type_read",
      platformCapability: "workfront_planning_record_type_read",
      action: "read",
      approvalRequired: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["recordTypeId"],
        properties: { recordTypeId: id, approvalId },
      },
    },
  ],
  approvalProfiles: [
    {
      id: "workfront_planning_safe",
      label: "Safe",
      description:
        "Every private metadata read requires approval. Fixed origins, technical-account authority, bounds, field allowlists, token caching, redaction and audits always apply.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected reads run without Relay per-action approval; fixed origins, technical-account authority, bounds, field allowlists, redaction and audits still apply.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "workspaces",
      label: "Adobe IMS credential, tenant hostname and workspace validation",
    },
  ],
};
