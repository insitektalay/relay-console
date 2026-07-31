import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "suitecrm_cloud_api_read",
  "Read SuiteCRM Hosted",
  "Read bounded module metadata, selected CRM records, collections, and relationships through the V8 JSON API.",
);
const manage = action(
  "suitecrm_cloud_api_manage",
  "Manage SuiteCRM Hosted",
  "Create, update, delete, link, or unlink selected CRM records through exact V8 JSON API operations.",
);
const guards = [
  action(
    "suitecrm_cloud_secret_exposure",
    "Expose credentials",
    "The customer OAuth client ID, client secret, and derived access tokens never enter agent-visible requests or results.",
  ),
  action(
    "suitecrm_cloud_unofficial_origin",
    "Use another origin",
    "Every token and CRM request stays on the exact configured official SuiteCRM Hosted subdomain.",
  ),
  action(
    "suitecrm_cloud_unsupported_operation",
    "Call another operation",
    "Relay permits only selected V8 metadata, core module, and relationship operations.",
  ),
  action(
    "suitecrm_cloud_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds modules, fields, filters, pages, bodies, responses, redirects, nesting, and execution time.",
  ),
];
const modules = [
  "Accounts",
  "AOS_Contracts",
  "AOS_Invoices",
  "AOS_Products",
  "AOS_Quotes",
  "Calls",
  "Campaigns",
  "Cases",
  "Contacts",
  "Documents",
  "Leads",
  "Meetings",
  "Notes",
  "Opportunities",
  "Project",
  "ProjectTask",
  "Prospects",
  "Tasks",
];
const shared = {
  module: { type: "string", enum: modules },
  id: {
    type: "string",
    pattern:
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
  },
  linkField: { type: "string", maxLength: 100 },
  relatedModule: { type: "string", enum: modules },
  relatedId: {
    type: "string",
    pattern:
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
  },
};

export const SUITECRM_CLOUD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "suitecrm-cloud",
  name: "SuiteCRM Hosted",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.suitecrm.com/developer/api/developer-setup-guide/json-api/",
  providerWebsiteUrl: "https://suitecrm.com/suitecrmhosted/",
  capabilities: [
    {
      ...capability(
        "crm_read",
        "Read CRM and module metadata",
        "Read available modules, selected module fields, bounded record collections, individual records, and relationships.",
        true,
      ),
      platformCapability: "suitecrm_cloud_crm_read",
    },
    {
      ...capability(
        "crm_manage",
        "Manage core CRM records",
        "Create, update, delete, link, and unlink records in the selected sales, service, activity, project, document, and inventory modules.",
        true,
      ),
      platformCapability: "suitecrm_cloud_crm_manage",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "SUITECRM_CLOUD_HOST",
        label: "SuiteCRM Hosted domain",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Enter only the lowercase official hosted domain, such as acme.suiteondemand.com, without a scheme or path.",
      },
      {
        name: "SUITECRM_CLOUD_CLIENT_ID",
        label: "OAuth client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use the ID of a customer-owned client-credentials grant associated with a dedicated least-privilege SuiteCRM user.",
      },
      {
        name: "SUITECRM_CLOUD_CLIENT_SECRET",
        label: "OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use the secret recorded when the customer-owned OAuth client was created. SuiteCRM does not display it again after hashing it.",
      },
    ],
  },
  tools: [
    {
      name: "suitecrm-cloud.read",
      functionName: "suitecrm_cloud_api_read",
      aliases: ["suitecrm-cloud.read", "suitecrm_cloud_api_read"],
      capability: "crm_read",
      platformCapability: "suitecrm_cloud_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one selected bounded SuiteCRM V8 metadata, collection, record, or relationship read.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["modules", "fields", "list", "retrieve", "relationship"],
          },
          ...shared,
          fields: { type: "array", items: { type: "string" }, maxItems: 50 },
          pageNumber: { type: "integer", minimum: 1, maximum: 10000 },
          pageSize: { type: "integer", minimum: 1, maximum: 100 },
          sortField: { type: "string", maxLength: 100 },
          sortDirection: { type: "string", enum: ["ASC", "DESC"] },
          filters: { type: "object", maxProperties: 25 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "suitecrm-cloud.manage",
      functionName: "suitecrm_cloud_api_manage",
      aliases: ["suitecrm-cloud.manage", "suitecrm_cloud_api_manage"],
      capability: "crm_manage",
      platformCapability: "suitecrm_cloud_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one selected SuiteCRM V8 core-record or relationship mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["create", "update", "delete", "link", "unlink"],
          },
          ...shared,
          attributes: {
            type: "object",
            minProperties: 1,
            maxProperties: 200,
          },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation", "module"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "suitecrm_cloud_safe",
      label: "Safe",
      description:
        "Selected bounded metadata and CRM reads run directly. Every create, update, delete, link, and unlink requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected CRM mutations authorized by the associated SuiteCRM user run without Relay per-action approval. Exact tenant binding, provider ACLs, selected modules, typed routes, bounds, token protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "oauth-client",
      label: "SuiteCRM Hosted client-credentials and V8 metadata validation",
    },
  ],
};
