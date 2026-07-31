import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "vtiger_crm_api_read",
  "Read Vtiger CRM",
  "Read bounded user, metadata, core CRM record, relationship, tag, hierarchy, synchronization, and lookup data through selected documented operations.",
);
const manage = action(
  "vtiger_crm_api_manage",
  "Manage Vtiger CRM",
  "Create, update, revise, delete, reopen, relate, or tag a selected core CRM record through one documented operation.",
);
const guards = [
  action(
    "vtiger_crm_secret_exposure",
    "Expose credentials",
    "The customer username and access key never enter agent-visible requests or results.",
  ),
  action(
    "vtiger_crm_unofficial_origin",
    "Use another API origin",
    "Every request stays on the exact validated Vtiger instance and od1, od2, or od3 cluster.",
  ),
  action(
    "vtiger_crm_unsupported_operation",
    "Call another operation",
    "Relay permits only selected documented core CRM, metadata, relation, tag, lookup, and sync operations.",
  ),
  action(
    "vtiger_crm_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds modules, fields, filters, offsets, limits, arrays, bodies, responses, redirects, nesting, and execution time.",
  ),
];

const modules = [
  "Accounts",
  "Calendar",
  "Campaigns",
  "Contacts",
  "Documents",
  "Events",
  "HelpDesk",
  "Invoice",
  "Leads",
  "Potentials",
  "Products",
  "Project",
  "ProjectTask",
  "PurchaseOrder",
  "Quotes",
  "SalesOrder",
  "Services",
  "Tasks",
  "Vendors",
];

const sharedProperties = {
  module: { type: "string", enum: modules },
  recordId: { type: "string", pattern: "^[0-9]{1,10}x[0-9]{1,20}$" },
  relatedRecordId: { type: "string", pattern: "^[0-9]{1,10}x[0-9]{1,20}$" },
  relatedLabel: { type: "string", enum: modules },
  relatedType: { type: "string", enum: modules },
};

export const VTIGER_CRM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "vtiger-crm",
  name: "Vtiger CRM",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://help.vtiger.com/article/147111249-Rest-API-Manual",
  providerWebsiteUrl: "https://www.vtiger.com/",
  capabilities: [
    {
      ...capability(
        "crm_read",
        "Read CRM and metadata",
        "Read the connected user, selected core modules and records, metadata, bounded queries, sync changes, relations, tags, picklist dependencies, account hierarchy, and exact phone or email lookups.",
        true,
      ),
      platformCapability: "vtiger_crm_read",
    },
    {
      ...capability(
        "crm_manage",
        "Manage core CRM records",
        "Create, fully update, partially revise, delete, reopen, relate, unrelate, add tags to, or remove tags from selected core CRM records.",
        true,
      ),
      platformCapability: "vtiger_crm_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "VTIGER_INSTANCE",
        label: "Vtiger instance",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Enter only the first subdomain from your Vtiger CRM URL, such as acme from acme.od1.vtiger.com.",
      },
      {
        name: "VTIGER_CLUSTER",
        label: "Vtiger cluster",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Enter od1, od2, or od3 exactly as shown in your Vtiger CRM URL.",
      },
      {
        name: "VTIGER_USERNAME",
        label: "Vtiger username",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Enter the login email of the dedicated Vtiger user whose provider permissions Relay should preserve.",
      },
      {
        name: "VTIGER_ACCESS_KEY",
        label: "Vtiger access key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Copy the user's Access Key from My Preferences. Relay encrypts it and uses it only for HTTP Basic authentication to the validated instance.",
      },
    ],
  },
  tools: [
    {
      name: "vtiger-crm.read",
      functionName: "vtiger_crm_api_read",
      aliases: ["vtiger-crm.read", "vtiger_crm_api_read"],
      capability: "crm_read",
      platformCapability: "vtiger_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one selected bounded Vtiger REST read operation against the connected instance.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [
              "me",
              "list_types",
              "describe",
              "retrieve",
              "query",
              "sync",
              "related_types",
              "retrieve_related",
              "query_related",
              "picklist_dependency",
              "tags_retrieve",
              "account_hierarchy",
              "lookup",
            ],
          },
          ...sharedProperties,
          fields: { type: "array", items: { type: "string" }, maxItems: 50 },
          fieldTypes: {
            type: "array",
            items: { type: "string" },
            maxItems: 25,
          },
          filter: { type: "string", maxLength: 2000 },
          orderBy: { type: "array", items: { type: "string" }, maxItems: 10 },
          direction: { type: "string", enum: ["ASC", "DESC"] },
          offset: { type: "integer", minimum: 0, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
          modifiedTime: { type: "integer", minimum: 0, maximum: 4102444800 },
          syncType: {
            type: "string",
            enum: ["user", "userandgroup", "application"],
          },
          sourceField: { type: "string", maxLength: 100 },
          targetField: { type: "string", maxLength: 100 },
          lookupType: { type: "string", enum: ["phone", "email"] },
          value: { type: "string", maxLength: 500 },
          searchIn: { type: "object", maxProperties: 10 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "vtiger-crm.manage",
      functionName: "vtiger_crm_api_manage",
      aliases: ["vtiger-crm.manage", "vtiger_crm_api_manage"],
      capability: "crm_manage",
      platformCapability: "vtiger_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one selected Vtiger core-record mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [
              "create",
              "update",
              "revise",
              "delete",
              "add_related",
              "delete_related",
              "reopen",
              "tags_add",
              "tags_delete",
            ],
          },
          ...sharedProperties,
          element: { type: "object", minProperties: 1, maxProperties: 200 },
          tags: {
            type: "array",
            items: { type: "string", maxLength: 100 },
            minItems: 1,
            maxItems: 25,
          },
          deleteAll: { type: "boolean" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "vtiger_crm_safe",
      label: "Safe",
      description:
        "Selected bounded reads run directly. Every create, update, revise, delete, reopen, relation change, and tag change requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected core CRM mutations authorized by the connected Vtiger user run without Relay per-action approval. Exact instance binding, provider roles, route and module allowlists, bounds, redaction, provider quotas, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    { id: "access-key", label: "Vtiger connected-user access-key validation" },
  ],
};
