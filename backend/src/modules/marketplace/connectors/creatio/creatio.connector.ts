import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "creatio_api_read",
  "Read Creatio",
  "Read bounded selected core CRM and low-code business records through Creatio's OData 4 service.",
);
const manage = action(
  "creatio_api_manage",
  "Manage Creatio",
  "Create, update, or delete a selected core Creatio record through one exact OData 4 operation.",
);
const guards = [
  action(
    "creatio_secret_exposure",
    "Expose credentials",
    "The customer username, password, authentication cookies, and CSRF token never enter agent-visible requests or results.",
  ),
  action(
    "creatio_unofficial_origin",
    "Use another origin",
    "Every authentication and OData request stays on the exact configured official Creatio Cloud tenant.",
  ),
  action(
    "creatio_unsupported_operation",
    "Call another operation",
    "Relay permits only selected OData 4 core-entity list, retrieve, create, update, and delete operations.",
  ),
  action(
    "creatio_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds entities, fields, filters, offsets, pages, bodies, responses, redirects, nesting, and execution time.",
  ),
];

const entities = [
  "Account",
  "Activity",
  "Campaign",
  "Case",
  "Contact",
  "Contract",
  "Document",
  "Invoice",
  "Lead",
  "Opportunity",
  "Order",
  "Product",
];

const sharedProperties = {
  entity: { type: "string", enum: entities },
  recordId: {
    type: "string",
    pattern:
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
  },
};

export const CREATIO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "creatio",
  name: "Creatio",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://academy.creatio.com/docs/developer/integrations_and_api/data_services/odata/overview/odata_odata_4",
  providerWebsiteUrl: "https://www.creatio.com/",
  capabilities: [
    {
      ...capability(
        "crm_read",
        "Read CRM and business records",
        "Read bounded records and selected fields from core account, contact, lead, opportunity, case, activity, campaign, contract, document, invoice, order, and product entities.",
        true,
      ),
      platformCapability: "creatio_crm_read",
    },
    {
      ...capability(
        "crm_manage",
        "Manage CRM and business records",
        "Create, update, and delete records in selected core Creatio CRM and low-code business entities.",
        true,
      ),
      platformCapability: "creatio_crm_manage",
    },
  ],
  auth: {
    type: "custom",
    credentialSchema: [
      {
        name: "CREATIO_HOST",
        label: "Creatio Cloud domain",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Enter only the lowercase Creatio Cloud domain, such as acme.creatio.com, without a scheme or path.",
      },
      {
        name: "CREATIO_USERNAME",
        label: "Creatio integration username",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated integration user's login whose Creatio object, record, and column permissions Relay should preserve.",
      },
      {
        name: "CREATIO_PASSWORD",
        label: "Creatio integration password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use the dedicated user's password. Relay encrypts it and sends it only to the validated tenant authentication service.",
      },
    ],
  },
  tools: [
    {
      name: "creatio.read",
      functionName: "creatio_api_read",
      aliases: ["creatio.read", "creatio_api_read"],
      capability: "crm_read",
      platformCapability: "creatio_crm_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one selected bounded Creatio OData 4 collection or record read against the connected cloud tenant.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["list", "retrieve"] },
          ...sharedProperties,
          fields: { type: "array", items: { type: "string" }, maxItems: 50 },
          filters: { type: "object", maxProperties: 25 },
          orderBy: { type: "string", maxLength: 100 },
          direction: { type: "string", enum: ["asc", "desc"] },
          top: { type: "integer", minimum: 1, maximum: 100 },
          skip: { type: "integer", minimum: 0, maximum: 10000 },
        },
        required: ["operation", "entity"],
        additionalProperties: false,
      },
    },
    {
      name: "creatio.manage",
      functionName: "creatio_api_manage",
      aliases: ["creatio.manage", "creatio_api_manage"],
      capability: "crm_manage",
      platformCapability: "creatio_crm_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one selected Creatio core-record mutation; Safe mode requires approval.",
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
        required: ["operation", "entity"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "creatio_safe",
      label: "Safe",
      description:
        "Selected bounded core-record reads run directly. Every create, update, and delete requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected record mutations authorized by the dedicated Creatio user run without Relay per-action approval. Exact tenant binding, provider permissions, typed routes, bounds, cookie protection, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "forms-authentication",
      label: "Creatio Cloud integration-user and OData validation",
    },
  ],
};
