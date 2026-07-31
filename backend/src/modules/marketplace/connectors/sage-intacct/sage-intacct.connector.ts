import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "sage_intacct_reporting_period_list",
    "List reporting periods",
    "List at most twenty-five bounded reporting-period summaries from Sage Intacct's first collection response.",
  ),
  action(
    "sage_intacct_reporting_period_get",
    "Read reporting period",
    "Read one exact bounded reporting-period summary by opaque provider key.",
  ),
];
const blockedActions = [
  blocked(
    "sage_intacct_record_mutation",
    "Change Sage Intacct data",
    "Creating, updating, deleting, posting, approving, closing, reopening, importing, or otherwise changing Sage Intacct records is outside V1.",
  ),
  blocked(
    "sage_intacct_private_business_data",
    "Read private business data",
    "Customers, vendors, contacts, employees, users, addresses, communications, attachments, notes, and custom fields are outside V1.",
  ),
  blocked(
    "sage_intacct_financial_and_broader_product",
    "Access financial or broader Sage Intacct data",
    "Accounts, balances, budgets, journals, transactions, bills, invoices, payments, banking, tax, payroll, expenses, purchasing, inventory, projects, reports, administration, and other modules are outside V1.",
  ),
  blocked(
    "sage_intacct_raw_api",
    "Call arbitrary Sage Intacct APIs",
    "Other origins, REST objects, fields, filters, query service calls, XML Web Services, DDS, methods, paths, request options, entity switches, and raw requests are outside V1.",
  ),
  blocked(
    "sage_intacct_bulk_export",
    "Export Sage Intacct data",
    "Automatic pagination, polling, crawling, synchronization, downloads, imports, offline jobs, batch operations, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const SAGE_INTACCT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "sage-intacct",
  name: "Sage Intacct",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.sage.com/intacct/",
  providerWebsiteUrl: "https://www.sage.com/en-us/sage-business-cloud/intacct/",
  capabilities: [
    {
      ...capability(
        "reporting_period_read",
        "Read reporting periods",
        "List bounded reporting-period summaries or inspect one exact period without accounts, balances, budgets, transactions, reports, people, or relationships.",
        true,
      ),
      platformCapability: "sage_intacct_reporting_period_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "SAGE_INTACCT_CLIENT_ID",
        label: "Sage Intacct REST client ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the client ID for the customer-owned production REST application authorized in the target company.",
      },
      {
        name: "SAGE_INTACCT_CLIENT_SECRET",
        label: "Sage Intacct REST client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Store the matching client secret only through Relay's encrypted credential boundary.",
      },
      {
        name: "SAGE_INTACCT_USERNAME",
        label: "Dedicated Sage Intacct Web Services username",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use the exact API-only username bound to the authorized client application and target company; include the entity suffix only when intentionally binding an entity.",
      },
    ],
  },
  tools: [
    {
      name: "sage-intacct.listReportingPeriods",
      functionName: "sage_intacct_reporting_period_list",
      aliases: [
        "sage-intacct.listReportingPeriods",
        "sage_intacct_reporting_period_list",
      ],
      capability: "reporting_period_read",
      platformCapability: "sage_intacct_reporting_period_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five bounded reporting-period summaries from the first provider collection response.",
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
      name: "sage-intacct.getReportingPeriod",
      functionName: "sage_intacct_reporting_period_get",
      aliases: [
        "sage-intacct.getReportingPeriod",
        "sage_intacct_reporting_period_get",
      ],
      capability: "reporting_period_read",
      platformCapability: "sage_intacct_reporting_period_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded reporting-period summary.",
      inputSchema: {
        type: "object",
        properties: {
          periodKey: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,200}$",
          },
          approvalId,
        },
        required: ["periodKey"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "sage_intacct_safe",
      label: "Safe",
      description:
        "Both private reporting-period reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both selected read-only tools run without Relay per-action approval while exact token endpoint, API origin, username/company binding, object, paths, limits, audits, redaction, provider permissions, and credential isolation remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "reporting-periods",
      label:
        "Sage Intacct client, Web Services user, company authorization, and reporting-period read validation",
    },
  ],
};
