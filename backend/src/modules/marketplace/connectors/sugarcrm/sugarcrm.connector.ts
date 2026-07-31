import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "sugarcrm_api_read",
  "Read SugarCRM",
  "Read bounded selected core CRM record collections and individual records through Sugar's REST v11 API.",
);
const manage = action(
  "sugarcrm_api_manage",
  "Manage SugarCRM",
  "Create, update, or delete a selected core CRM record through one exact REST v11 operation.",
);
const guards = [
  action(
    "sugarcrm_secret_exposure",
    "Expose credentials",
    "The customer OAuth key, username, password, and derived Sugar tokens never enter agent-visible requests or results.",
  ),
  action(
    "sugarcrm_unofficial_origin",
    "Use another origin",
    "Every token and CRM request stays on the exact configured official SugarCloud sugarondemand.com tenant.",
  ),
  action(
    "sugarcrm_unsupported_operation",
    "Call another operation",
    "Relay permits only selected REST v11 core-module list, retrieve, create, update, and delete operations.",
  ),
  action(
    "sugarcrm_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds modules, fields, filters, offsets, pages, bodies, responses, redirects, nesting, and execution time.",
  ),
];

const modules = [
  "Accounts",
  "Calls",
  "Campaigns",
  "Cases",
  "Contacts",
  "Contracts",
  "Documents",
  "Leads",
  "Meetings",
  "Notes",
  "Opportunities",
  "Products",
  "Prospects",
  "Quotes",
  "RevenueLineItems",
  "Tasks",
];

const sharedProperties = {
  module: { type: "string", enum: modules },
  recordId: {
    type: "string",
    pattern:
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
  },
};

export const SUGARCRM_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sugarcrm",
  name: "SugarCRM",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.sugarcrm.com/documentation/sugar_developer/sugar_developer_guide_25.2/cookbook/web_services/rest_api/php/how_to_manipulate_records_crud/",
  providerWebsiteUrl: "https://www.sugarcrm.com/",
  capabilities: [
    {
      ...capability(
        "crm_read",
        "Read core CRM records",
        "Read selected core sales, service, activity, campaign, document, contract, product, and quote record collections and individual records.",
        true,
      ),
      platformCapability: "sugarcrm_crm_read",
    },
    {
      ...capability(
        "crm_manage",
        "Manage core CRM records",
        "Create, update, and delete records in selected core sales, service, activity, campaign, document, contract, product, and quote modules.",
        true,
      ),
      platformCapability: "sugarcrm_crm_manage",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "SUGARCRM_HOST",
        label: "SugarCloud domain",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Enter only the lowercase SugarCloud domain, such as acme.sugarondemand.com, without a scheme or path.",
      },
      {
        name: "SUGARCRM_CLIENT_ID",
        label: "OAuth client ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use the client ID from a customer-owned Sugar OAuth Key created for this integration.",
      },
      {
        name: "SUGARCRM_CLIENT_SECRET",
        label: "OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use the secret from the customer-owned Sugar OAuth Key. Relay encrypts it and never exposes it to agents.",
      },
      {
        name: "SUGARCRM_USERNAME",
        label: "SugarCRM username",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use the username of a dedicated least-privilege Sugar user whose provider roles and teams Relay should preserve.",
      },
      {
        name: "SUGARCRM_PASSWORD",
        label: "SugarCRM password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use the dedicated Sugar user's password. Relay encrypts it and exchanges it only at the validated tenant token endpoint.",
      },
    ],
  },
  tools: [
    {
      name: "sugarcrm.read",
      functionName: "sugarcrm_api_read",
      aliases: ["sugarcrm.read", "sugarcrm_api_read"],
      capability: "crm_read",
      platformCapability: "sugarcrm_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one selected bounded SugarCRM REST v11 collection or record read against the connected SugarCloud tenant.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["list", "retrieve"] },
          ...sharedProperties,
          fields: { type: "array", items: { type: "string" }, maxItems: 50 },
          filters: { type: "object", maxProperties: 25 },
          orderBy: { type: "string", maxLength: 100 },
          direction: { type: "string", enum: ["ASC", "DESC"] },
          maxNum: { type: "integer", minimum: 1, maximum: 100 },
          offset: { type: "integer", minimum: 0, maximum: 10000 },
        },
        required: ["operation", "module"],
        additionalProperties: false,
      },
    },
    {
      name: "sugarcrm.manage",
      functionName: "sugarcrm_api_manage",
      aliases: ["sugarcrm.manage", "sugarcrm_api_manage"],
      capability: "crm_manage",
      platformCapability: "sugarcrm_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one selected SugarCRM core-record mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["create", "update", "delete"],
          },
          ...sharedProperties,
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
      id: "sugarcrm_safe",
      label: "Safe",
      description:
        "Selected bounded core CRM reads run directly. Every create, update, and delete requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected core CRM mutations authorized by the dedicated Sugar user run without Relay per-action approval. Exact tenant binding, provider roles and teams, typed routes, bounds, token protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "oauth-password-grant",
      label: "SugarCloud OAuth key and dedicated-user validation",
    },
  ],
};
