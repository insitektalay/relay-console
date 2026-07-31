import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "structure_for_jira_structures_list",
    "List structures",
    "List at most twenty bounded Structure Cloud structure summaries.",
  ),
  action(
    "structure_for_jira_structure_get",
    "Read structure",
    "Read bounded metadata for one exact numeric Structure Cloud structure ID.",
  ),
  action(
    "structure_for_jira_views_list",
    "List views",
    "List at most twenty bounded Structure Cloud view summaries.",
  ),
  action(
    "structure_for_jira_view_get",
    "Read view",
    "Read bounded layout metadata for one exact Structure Cloud view UUID.",
  ),
];
const writes = [
  action(
    "structure_for_jira_structure_create",
    "Create private structure",
    "Create one empty private structure without generators, Jira queries or sharing.",
  ),
];
const allActions = [...reads, ...writes];
const blockedActions = [
  blocked(
    "structure_for_jira_sharing",
    "Change sharing or ownership",
    "Permissions, sharing, owners, bulk owner changes and administrative access are unavailable.",
  ),
  blocked(
    "structure_for_jira_generators",
    "Configure generators",
    "JQL, inserters, extenders, sorters, groups, filters and other generators are unavailable.",
  ),
  blocked(
    "structure_for_jira_views_write",
    "Create or change views",
    "View creation, columns, formulas, flex fields, default-view changes and view mutation are unavailable.",
  ),
  blocked(
    "structure_for_jira_hierarchy_write",
    "Change hierarchy content",
    "Rows, Jira work items, folders, forests, hierarchy mutations and broader Jira APIs are unavailable.",
  ),
  blocked(
    "structure_for_jira_data_center",
    "Use Data Center APIs",
    "Structure Data Center's separate instance-local and version-sensitive APIs are outside this Cloud connection.",
  ),
  blocked(
    "structure_for_jira_raw_api",
    "Run arbitrary Structure calls",
    "Agents cannot choose API origins, paths, offsets, query filters, request bodies or raw API operations.",
  ),
  blocked(
    "structure_for_jira_unbounded",
    "Export Structure data",
    "Twenty-row lists, one exact resource, twenty view column keys and 256 KiB responses are the maximum supported surface.",
  ),
];
const structureId = { type: "integer", minimum: 1, maximum: 9007199254740991 };
const viewId = { type: "string", format: "uuid", maxLength: 36 };

export const STRUCTURE_FOR_JIRA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "structure-for-jira",
    name: "Structure for Jira",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://apidocs.structure.app/api",
    providerWebsiteUrl:
      "https://www.tempo.io/products/project-portfolio-management-software-ppm",
    capabilities: [
      {
        ...capability(
          "structure_read",
          "Read structures",
          "List bounded structure summaries and inspect one exact structure.",
          true,
        ),
        platformCapability: "structure_for_jira_structure_read",
      },
      {
        ...capability(
          "view_read",
          "Read views",
          "List bounded view summaries and inspect one exact view's bounded layout metadata.",
          true,
        ),
        platformCapability: "structure_for_jira_view_read",
      },
      {
        ...capability(
          "structure_create",
          "Create private structures",
          "Create one empty private structure without generators or sharing.",
          false,
        ),
        platformCapability: "structure_for_jira_structure_create",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "STRUCTURE_FOR_JIRA_PERSONAL_ACCESS_TOKEN",
          label: "Structure Cloud personal access token",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "An expiring Structure Cloud personal access token created by the intended Jira user.",
        },
        {
          name: "STRUCTURE_FOR_JIRA_REGION",
          label: "Structure Cloud region",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "Enter americas or europe to pin Railway to Structure Cloud's documented regional API origin.",
        },
      ],
    },
    tools: [
      {
        name: "structureForJira.listStructures",
        functionName: "structure_for_jira_structures_list",
        aliases: [
          "structureForJira.listStructures",
          "structure_for_jira_structures_list",
        ],
        capability: "structure_read",
        platformCapability: "structure_for_jira_structure_read",
        action: "read",
        approvalRequired: true,
        description: "List at most twenty fixed-field structures.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "structureForJira.getStructure",
        functionName: "structure_for_jira_structure_get",
        aliases: [
          "structureForJira.getStructure",
          "structure_for_jira_structure_get",
        ],
        capability: "structure_read",
        platformCapability: "structure_for_jira_structure_read",
        action: "read",
        approvalRequired: true,
        description: "Read one exact structure.",
        inputSchema: {
          type: "object",
          required: ["structureId"],
          properties: {
            structureId,
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "structureForJira.createPrivateStructure",
        functionName: "structure_for_jira_structure_create",
        aliases: [
          "structureForJira.createPrivateStructure",
          "structure_for_jira_structure_create",
        ],
        capability: "structure_create",
        platformCapability: "structure_for_jira_structure_create",
        action: "write",
        approvalRequired: true,
        description: "Create one empty private structure.",
        inputSchema: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            description: { type: "string", maxLength: 1000 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "structureForJira.listViews",
        functionName: "structure_for_jira_views_list",
        aliases: [
          "structureForJira.listViews",
          "structure_for_jira_views_list",
        ],
        capability: "view_read",
        platformCapability: "structure_for_jira_view_read",
        action: "read",
        approvalRequired: true,
        description: "List at most twenty fixed-field views.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "structureForJira.getView",
        functionName: "structure_for_jira_view_get",
        aliases: ["structureForJira.getView", "structure_for_jira_view_get"],
        capability: "view_read",
        platformCapability: "structure_for_jira_view_read",
        action: "read",
        approvalRequired: true,
        description: "Read one exact view's bounded layout metadata.",
        inputSchema: {
          type: "object",
          required: ["viewId"],
          properties: {
            viewId,
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "structure_for_jira_safe",
        label: "Safe",
        description:
          "Private reads and private structure creation require approval. Fixed origins, bounds, token authority and audits always apply.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: allActions,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All five selected Structure Cloud actions run without Relay per-action approval; fixed regional origin, token authority, bounds, redaction and audits still apply.",
        defaultSelected: false,
        allowedActions: allActions,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "structure-cloud-token",
        label: "Structure Cloud token and regional data access",
      },
    ],
  };
