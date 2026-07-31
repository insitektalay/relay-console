import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "odoo_user_get",
    "Read current user",
    "Read bounded identity metadata for the exact API-key-bound Odoo user.",
  ),
  action(
    "odoo_project_list",
    "List projects",
    "List at most twenty-five bounded Project summaries from fixed offset zero.",
  ),
  action(
    "odoo_project_get",
    "Read project",
    "Read one exact bounded Project summary by positive numeric ID.",
  ),
];
const blockedActions = [
  blocked(
    "odoo_record_mutation",
    "Change Odoo data",
    "Creating, updating, assigning, archiving, completing, deleting, importing, sending, posting, approving, or bulk-changing Odoo records is outside V1.",
  ),
  blocked(
    "odoo_private_business_data",
    "Read private business data",
    "Contacts, customers, vendors, employees, users beyond the bound identity, emails, phones, addresses, descriptions, tasks, messages, attachments, followers, activities, timesheets, custom fields, and relationships are outside V1.",
  ),
  blocked(
    "odoo_financial_and_broader_product",
    "Access financial or broader Odoo data",
    "CRM, sales, accounting, invoices, payments, expenses, inventory, purchase, manufacturing, HR, payroll, recruitment, marketing, websites, eCommerce, helpdesk, documents, administration, and installed apps are outside V1.",
  ),
  blocked(
    "odoo_raw_api",
    "Call arbitrary Odoo APIs",
    "Custom origins, databases, models, methods, fields, domains, contexts, orders, offsets, limits, payloads, legacy RPC, raw JSON-2, and dynamic documentation are outside V1.",
  ),
  blocked(
    "odoo_bulk_export",
    "Export Odoo data",
    "Automatic pagination, crawling, synchronization, report generation, downloads, imports, database operations, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const ODOO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "odoo",
  name: "Odoo",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://www.odoo.com/documentation/19.0/developer/reference/external_api.html",
  providerWebsiteUrl: "https://www.odoo.com/",
  capabilities: [
    {
      ...capability(
        "user_read",
        "Read current user",
        "Read bounded identity metadata for the exact API-key-bound user without name, login, email, company, groups, or permissions.",
        true,
      ),
      platformCapability: "odoo_user_read",
    },
    {
      ...capability(
        "project_read",
        "Read projects",
        "List bounded Odoo Project summaries or inspect one exact Project without customers, users, tasks, messages, descriptions, activities, timesheets, custom fields, or relationships.",
        true,
      ),
      platformCapability: "odoo_project_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ODOO_DATABASE",
        label: "Odoo Online database",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter only the database label before .odoo.com. V1 supports Odoo Online 19 Custom plans and derives the exact origin from this value.",
      },
      {
        name: "ODOO_API_KEY",
        label: "Odoo API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a short-lived key for a dedicated least-privilege bot user under Preferences > Account Security. Odoo keys expire within three months and must be rotated.",
      },
    ],
  },
  tools: [
    {
      name: "odoo.getCurrentUser",
      functionName: "odoo_user_get",
      aliases: ["odoo.getCurrentUser", "odoo_user_get"],
      capability: "user_read",
      platformCapability: "odoo_user_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read bounded identity metadata for the exact API-key-bound Odoo user.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "odoo.listProjects",
      functionName: "odoo_project_list",
      aliases: ["odoo.listProjects", "odoo_project_list"],
      capability: "project_read",
      platformCapability: "odoo_project_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five bounded Project summaries from fixed offset zero.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "odoo.getProject",
      functionName: "odoo_project_get",
      aliases: ["odoo.getProject", "odoo_project_get"],
      capability: "project_read",
      platformCapability: "odoo_project_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded Project summary.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "integer", minimum: 1 },
          approvalId,
        },
        required: ["projectId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "odoo_safe",
      label: "Safe",
      description:
        "All three bounded private user and Project reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact database, user, and resource binding, fixed origin, models, methods, fields, limits, audits, redaction, provider rights, and key isolation remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "user",
      label: "Odoo Online 19 database, API key, user, and JSON-2 validation",
    },
  ],
};
