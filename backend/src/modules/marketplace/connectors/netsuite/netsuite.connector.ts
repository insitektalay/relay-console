import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "netsuite_accounting_period_list",
    "List accounting periods",
    "List at most twenty-five bounded accounting-period status summaries from fixed offset zero.",
  ),
  action(
    "netsuite_accounting_period_get",
    "Read accounting period",
    "Read one exact bounded accounting-period status summary by positive internal ID.",
  ),
];
const blockedActions = [
  blocked(
    "netsuite_record_mutation",
    "Change NetSuite data",
    "Creating, updating, deleting, transforming, approving, posting, closing, reopening, locking, importing, or bulk-changing NetSuite records is outside V1.",
  ),
  blocked(
    "netsuite_private_business_data",
    "Read private business data",
    "Customers, contacts, vendors, employees, users, communications, addresses, notes, files, custom fields, relationships, and transaction details are outside V1.",
  ),
  blocked(
    "netsuite_financial_and_broader_product",
    "Access financial or broader NetSuite data",
    "Accounts, balances, journals, invoices, payments, banking, tax, payroll, expenses, orders, inventory, projects, CRM, commerce, analytics, reports, administration, and SuiteApps are outside V1.",
  ),
  blocked(
    "netsuite_raw_api",
    "Call arbitrary NetSuite APIs",
    "Other origins, REST records, fields, filters, queries, SuiteQL, RESTlets, SOAP, SuiteScript, metadata, actions, transformations, and request options are outside V1.",
  ),
  blocked(
    "netsuite_bulk_export",
    "Export NetSuite data",
    "Automatic pagination, crawling, synchronization, report execution, downloads, imports, asynchronous jobs, batch operations, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const NETSUITE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "netsuite",
  name: "NetSuite",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_1540391670.html",
  providerWebsiteUrl: "https://www.netsuite.com/",
  capabilities: [
    {
      ...capability(
        "accounting_period_read",
        "Read accounting periods",
        "List bounded accounting-period status summaries or inspect one exact period without transactions, balances, subsidiaries, books, calendars, notes, or relationships.",
        true,
      ),
      platformCapability: "netsuite_accounting_period_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "NETSUITE_ACCOUNT_ID",
        label: "NetSuite account ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the exact production, sandbox, or Release Preview account ID used as the TBA realm.",
      },
      {
        name: "NETSUITE_SUITETALK_ORIGIN",
        label: "SuiteTalk origin",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the exact HTTPS SuiteTalk (SOAP and REST) origin from Company Information > Company URLs; do not construct or customize it.",
      },
      {
        name: "NETSUITE_CONSUMER_KEY",
        label: "TBA consumer key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "NETSUITE_CONSUMER_SECRET",
        label: "TBA consumer secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "NETSUITE_TOKEN_ID",
        label: "TBA token ID",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
      {
        name: "NETSUITE_TOKEN_SECRET",
        label: "TBA token secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
      },
    ],
  },
  tools: [
    {
      name: "netsuite.listAccountingPeriods",
      functionName: "netsuite_accounting_period_list",
      aliases: [
        "netsuite.listAccountingPeriods",
        "netsuite_accounting_period_list",
      ],
      capability: "accounting_period_read",
      platformCapability: "netsuite_accounting_period_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five bounded accounting-period status summaries from fixed offset zero.",
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
      name: "netsuite.getAccountingPeriod",
      functionName: "netsuite_accounting_period_get",
      aliases: [
        "netsuite.getAccountingPeriod",
        "netsuite_accounting_period_get",
      ],
      capability: "accounting_period_read",
      platformCapability: "netsuite_accounting_period_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact bounded accounting-period status summary.",
      inputSchema: {
        type: "object",
        properties: {
          periodId: {
            type: "string",
            pattern: "^[1-9][0-9]{0,19}$",
          },
          approvalId,
        },
        required: ["periodId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "netsuite_safe",
      label: "Safe",
      description:
        "Both private accounting-period reads require matching approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both selected read-only tools run without Relay per-action approval while exact account, SuiteTalk origin, role, record type, fields, offset, limits, audits, redaction, provider permissions, and TBA secret isolation remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "accounting-periods",
      label:
        "NetSuite account, SuiteTalk origin, TBA role, and accounting-period read validation",
    },
  ],
};
