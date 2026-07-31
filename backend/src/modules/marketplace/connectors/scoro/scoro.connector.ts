import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "scoro_business_entity_get",
    "Read business entity",
    "Read bounded metadata for the exact configured Scoro business entity.",
  ),
  action(
    "scoro_project_list",
    "List projects",
    "List at most twenty-five bounded Project summaries from fixed page one.",
  ),
  action(
    "scoro_project_get",
    "Read project",
    "Read one exact bounded Project summary by positive numeric ID.",
  ),
];
const blockedActions = [
  blocked(
    "scoro_record_mutation",
    "Change Scoro data",
    "Creating, modifying, assigning, completing, deleting, uploading, sending, subscribing, or bulk-changing Scoro records is outside V1.",
  ),
  blocked(
    "scoro_private_business_data",
    "Read private business data",
    "Customers, contacts, companies, users, managers, emails, phones, addresses, descriptions, notes, comments, files, permissions, relationships, custom fields, and tags are outside V1.",
  ),
  blocked(
    "scoro_financial_and_broader_product",
    "Access financial or broader Scoro data",
    "Invoices, quotes, orders, bills, expenses, purchase orders, products, prices, costs, receipts, forecasts, calendar, tasks, time entries, bookings, notifications, reports, administration, and webhooks are outside V1.",
  ),
  blocked(
    "scoro_raw_api",
    "Call arbitrary Scoro APIs",
    "Arbitrary tenants, entities, modules, actions, methods, IDs, filters, bookmarks, pages, limits, detailed responses, payloads, and raw API access are outside V1.",
  ),
  blocked(
    "scoro_bulk_export",
    "Export Scoro data",
    "Automatic pagination, crawling, synchronization, PDF generation, downloads, batch operations, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const SCORO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "scoro",
  name: "Scoro",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.scoro.com/api/v2",
  providerWebsiteUrl: "https://www.scoro.com/",
  capabilities: [
    {
      ...capability(
        "business_entity_read",
        "Read business entity",
        "Read bounded metadata for the exact API-key-bound business entity without company contact, registration, tax, address, plan, or broader entity data.",
        true,
      ),
      platformCapability: "scoro_business_entity_read",
    },
    {
      ...capability(
        "project_read",
        "Read projects",
        "List bounded Project summaries or inspect one exact Project without customers, managers, people, descriptions, phases, permissions, relationships, custom fields, or tags.",
        true,
      ),
      platformCapability: "scoro_project_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SCORO_SITE",
        label: "Scoro tenant subdomain",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter only the tenant label before .scoro.com, such as examplecompany. Relay validates and pins the exact HTTPS origin.",
      },
      {
        name: "SCORO_COMPANY_ACCOUNT_ID",
        label: "Scoro business entity ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the exact company_account_id shown with the API key under Settings > External Connections > API.",
      },
      {
        name: "SCORO_API_KEY",
        label: "Scoro API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated least-privilege company-based API key. Relay stores it encrypted and never returns it to agents.",
      },
    ],
  },
  tools: [
    {
      name: "scoro.getBusinessEntity",
      functionName: "scoro_business_entity_get",
      aliases: ["scoro.getBusinessEntity", "scoro_business_entity_get"],
      capability: "business_entity_read",
      platformCapability: "scoro_business_entity_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read bounded metadata for the exact configured Scoro business entity.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "scoro.listProjects",
      functionName: "scoro_project_list",
      aliases: ["scoro.listProjects", "scoro_project_list"],
      capability: "project_read",
      platformCapability: "scoro_project_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five bounded Project summaries from fixed page one.",
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
      name: "scoro.getProject",
      functionName: "scoro_project_get",
      aliases: ["scoro.getProject", "scoro_project_get"],
      capability: "project_read",
      platformCapability: "scoro_project_read",
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
      id: "scoro_safe",
      label: "Safe",
      description:
        "All three bounded private business and Project reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact tenant, business entity, AppId, and resource binding, fixed paths, limits, audits, redaction, provider authority, and API-key isolation remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "business-entity",
      label:
        "Scoro tenant, business entity, public AppId, API key, and API validation",
    },
  ],
};
