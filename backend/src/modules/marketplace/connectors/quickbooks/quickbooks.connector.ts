import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const QUICKBOOKS_SCOPES = [
  "com.intuit.quickbooks.accounting",
  "payroll.compensation.read",
  "com.intuit.quickbooks.payment",
];

const companyRead = action(
  "quickbooks_company_info_get",
  "Read company information",
  "Read bounded metadata for the exact connected QuickBooks Online company.",
);
const invoiceReads = [
  action(
    "quickbooks_invoice_list",
    "List invoices",
    "List at most twenty-five privacy-redacted invoice summaries.",
  ),
  action(
    "quickbooks_invoice_get",
    "Read invoice",
    "Read one exact privacy-redacted invoice summary by numeric ID.",
  ),
];
const payrollCompensationRead = action(
  "quickbooks_payroll_compensations_list",
  "List employee pay types",
  "List at most ten bounded pay-type assignments for one exact numeric employee ID.",
);
const paymentChargeRead = action(
  "quickbooks_payment_charge_get",
  "Read payment charge status",
  "Read one exact privacy-redacted QuickBooks Payments charge status by opaque ID.",
);
const blockedActions = [
  blocked(
    "quickbooks_financial_write",
    "Change financial or payment records",
    "Invoice, payment creation/capture/void/refund, customer, vendor, bank, journal, tax, payroll, and settings writes are outside V1.",
  ),
  blocked(
    "quickbooks_private_data",
    "Read private accounting, payroll, or payment data",
    "Customer or employee identity, addresses, email, line items, notes, linked transactions, payment instruments, authorization codes, tokens, receipts, refunds, bank details, payslips, deductions, benefits, tax identifiers, reports, and raw errors are outside V1.",
  ),
  blocked(
    "quickbooks_broader_admin",
    "Administer QuickBooks",
    "Users, subscriptions, app administration, cards, bank accounts, eChecks, tokens, and broader company or Payments administration are outside V1.",
  ),
  blocked(
    "quickbooks_raw_api",
    "Use arbitrary QuickBooks APIs",
    "Arbitrary queries, paths, parameters, automatic pagination, and raw Accounting API access are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const QUICKBOOKS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "quickbooks",
  name: "QuickBooks Online",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0",
  providerWebsiteUrl: "https://quickbooks.intuit.com/",
  capabilities: [
    {
      ...capability(
        "company_read",
        "Read company information",
        "Read bounded metadata for the exact connected company.",
        true,
      ),
      platformCapability: "quickbooks_company_read",
    },
    {
      ...capability(
        "invoice_read",
        "Read invoices",
        "List bounded redacted invoice summaries or inspect one exact invoice.",
        true,
      ),
      platformCapability: "quickbooks_invoice_read",
    },
    {
      ...capability(
        "payroll_compensation_read",
        "Read employee pay types",
        "List bounded compensation-type assignments for one exact employee ID without employee identity or payroll amounts.",
        true,
      ),
      platformCapability: "quickbooks_payroll_compensation_read",
    },
    {
      ...capability(
        "payment_charge_read",
        "Read payment charge status",
        "Inspect one exact privacy-redacted charge status without payment-instrument or customer data.",
        true,
      ),
      platformCapability: "quickbooks_payment_charge_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://appcenter.intuit.com/connect/oauth2",
      tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      refreshUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      revocationUrl: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
      requiredScopes: QUICKBOOKS_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "quickbooks.getCompanyInfo",
      functionName: "quickbooks_company_info_get",
      aliases: ["quickbooks.getCompanyInfo", "quickbooks_company_info_get"],
      capability: "company_read",
      platformCapability: "quickbooks_company_read",
      action: "read",
      approvalRequired: false,
      description: "Read bounded metadata for the exact connected company.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "quickbooks.listInvoices",
      functionName: "quickbooks_invoice_list",
      aliases: ["quickbooks.listInvoices", "quickbooks_invoice_list"],
      capability: "invoice_read",
      platformCapability: "quickbooks_invoice_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty-five redacted invoice summaries.",
      inputSchema: {
        type: "object",
        properties: {
          startPosition: { type: "integer", minimum: 1, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "quickbooks.getInvoice",
      functionName: "quickbooks_invoice_get",
      aliases: ["quickbooks.getInvoice", "quickbooks_invoice_get"],
      capability: "invoice_read",
      platformCapability: "quickbooks_invoice_read",
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
    {
      name: "quickbooks.listPayrollCompensations",
      functionName: "quickbooks_payroll_compensations_list",
      aliases: [
        "quickbooks.listPayrollCompensations",
        "quickbooks_payroll_compensations_list",
      ],
      capability: "payroll_compensation_read",
      platformCapability: "quickbooks_payroll_compensation_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most ten pay-type assignments for one exact employee ID.",
      inputSchema: {
        type: "object",
        properties: {
          employeeId: { type: "string", pattern: "^[1-9][0-9]{0,31}$" },
          activeOnly: { type: "boolean" },
          countryCode: { type: "string", pattern: "^[A-Z]{2}$" },
          approvalId,
        },
        required: ["employeeId"],
        additionalProperties: false,
      },
    },
    {
      name: "quickbooks.getPaymentCharge",
      functionName: "quickbooks_payment_charge_get",
      aliases: [
        "quickbooks.getPaymentCharge",
        "quickbooks_payment_charge_get",
      ],
      capability: "payment_charge_read",
      platformCapability: "quickbooks_payment_charge_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read one exact privacy-redacted QuickBooks Payments charge status.",
      inputSchema: {
        type: "object",
        properties: {
          chargeId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,100}$",
          },
          approvalId,
        },
        required: ["chargeId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "quickbooks_safe",
      label: "Safe",
      description:
        "Company metadata runs directly; invoice, payroll compensation, and payment charge reads require matching approval.",
      defaultSelected: true,
      allowedActions: [companyRead],
      approvalRequiredActions: [
        ...invoiceReads,
        payrollCompensationRead,
        paymentChargeRead,
      ],
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All five selected read-only tools run without Relay per-action approval while exact-company binding, bounds, audit, redaction, token rotation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [
        companyRead,
        ...invoiceReads,
        payrollCompensationRead,
        paymentChargeRead,
      ],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "company",
      label: "QuickBooks Online authorization and exact company validation",
      requiredScopes: QUICKBOOKS_SCOPES,
    },
  ],
};
