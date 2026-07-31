import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const FREEAGENT_SCOPES: string[] = [];

const companyRead = action(
  "freeagent_company_get",
  "Read connected company",
  "Read bounded metadata for the exact connected FreeAgent company.",
);
const invoiceReads = [
  action(
    "freeagent_invoice_list",
    "List invoices",
    "List at most twenty-five privacy-redacted invoice summaries.",
  ),
  action(
    "freeagent_invoice_get",
    "Read invoice",
    "Read one exact privacy-redacted invoice summary by numeric ID.",
  ),
];
const blockedActions = [
  blocked(
    "freeagent_invoice_mutation",
    "Change invoices",
    "Creating, updating, emailing, transitioning, taking payment for, duplicating, or deleting invoices is outside V1.",
  ),
  blocked(
    "freeagent_private_accounting",
    "Read private accounting data",
    "Customer identity, invoice lines, comments, tax, bank, payment, PDF, email, and timeline data are outside V1.",
  ),
  blocked(
    "freeagent_broader_accounting",
    "Access broader accounting",
    "Contacts, projects, bills, banking, tax, payroll, expenses, users, and files are outside V1.",
  ),
  blocked(
    "freeagent_practice_api",
    "Use the Practice API",
    "The separately registered Accountancy Practice API is outside this company connector.",
  ),
  blocked(
    "freeagent_raw_api",
    "Use arbitrary API calls",
    "Arbitrary paths, parameters, XML, automatic pagination, and raw FreeAgent API access are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const FREEAGENT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "freeagent",
  name: "FreeAgent",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://dev.freeagent.com/docs/oauth",
  providerWebsiteUrl: "https://www.freeagent.com/",
  capabilities: [
    {
      ...capability(
        "company_read",
        "Read company",
        "Read bounded metadata for the exact connected FreeAgent company.",
        true,
      ),
      platformCapability: "freeagent_company_read",
    },
    {
      ...capability(
        "invoice_read",
        "Read invoices",
        "List bounded redacted invoice summaries or inspect one exact invoice.",
        true,
      ),
      platformCapability: "freeagent_invoice_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.freeagent.com/v2/approve_app",
      tokenUrl: "https://api.freeagent.com/v2/token_endpoint",
      refreshUrl: "https://api.freeagent.com/v2/token_endpoint",
      requiredScopes: FREEAGENT_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "freeagent.getConnectedCompany",
      functionName: "freeagent_company_get",
      aliases: ["freeagent.getConnectedCompany", "freeagent_company_get"],
      capability: "company_read",
      platformCapability: "freeagent_company_read",
      action: "read",
      approvalRequired: false,
      description: "Read bounded metadata for the exact connected company.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "freeagent.listInvoices",
      functionName: "freeagent_invoice_list",
      aliases: ["freeagent.listInvoices", "freeagent_invoice_list"],
      capability: "invoice_read",
      platformCapability: "freeagent_invoice_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty-five redacted invoice summaries.",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1, maximum: 10000 },
          view: {
            type: "string",
            enum: [
              "all",
              "recent_open_or_overdue",
              "open",
              "overdue",
              "open_or_overdue",
              "draft",
              "paid",
              "scheduled_to_email",
              "thank_you_emails",
              "reminder_emails",
            ],
          },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "freeagent.getInvoice",
      functionName: "freeagent_invoice_get",
      aliases: ["freeagent.getInvoice", "freeagent_invoice_get"],
      capability: "invoice_read",
      platformCapability: "freeagent_invoice_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact redacted invoice summary.",
      inputSchema: {
        type: "object",
        properties: {
          invoiceId: { type: "string", pattern: "^[1-9][0-9]{0,31}$" },
          approvalId,
        },
        required: ["invoiceId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "freeagent_safe",
      label: "Safe",
      description:
        "Connected-company metadata runs directly; invoice reads require matching approval.",
      defaultSelected: true,
      allowedActions: [companyRead],
      approvalRequiredActions: invoiceReads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact-company binding, provider-granted user permissions, bounds, audit, redaction, token refresh, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [companyRead, ...invoiceReads],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "company",
      label: "FreeAgent authorization and exact company validation",
      requiredScopes: FREEAGENT_SCOPES,
    },
  ],
};
