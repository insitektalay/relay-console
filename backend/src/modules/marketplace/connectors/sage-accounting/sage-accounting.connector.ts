import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "sage_accounting_business_get",
    "Read business summary",
    "Read one bounded summary for the exactly connected Sage Accounting business.",
  ),
  action(
    "sage_accounting_ledger_classification_list",
    "List ledger classifications",
    "List at most twenty-five ledger-account classifications from fixed page one.",
  ),
  action(
    "sage_accounting_ledger_classification_get",
    "Read ledger classification",
    "Read one exact bounded ledger-account classification by provider ID.",
  ),
];
const blockedActions = [
  blocked(
    "sage_accounting_record_mutation",
    "Change Sage Accounting data",
    "Creating, updating, deleting, posting, allocating, importing, or otherwise changing Sage Accounting records is outside V1.",
  ),
  blocked(
    "sage_accounting_private_business_data",
    "Read private business data",
    "Contacts, people, addresses, communication, notes, attachments, customers, suppliers, products, services, and custom data are outside V1.",
  ),
  blocked(
    "sage_accounting_financial_data",
    "Access financial data",
    "Ledger accounts, balances, journals, transactions, invoices, credit notes, payments, banking, tax, payroll, expenses, reports, and financial settings are outside V1.",
  ),
  blocked(
    "sage_accounting_raw_api",
    "Call arbitrary Sage APIs",
    "Other origins, businesses, paths, fields, filters, expands, query parameters, methods, API versions, and raw requests are outside V1.",
  ),
  blocked(
    "sage_accounting_bulk_export",
    "Export Sage Accounting data",
    "Automatic pagination, crawling, polling, synchronization, downloads, imports, batch operations, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const SAGE_ACCOUNTING_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "sage-accounting",
    name: "Sage Accounting",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developer.sage.com/accounting/reference/",
    providerWebsiteUrl:
      "https://www.sage.com/en-gb/sage-business-cloud/accounting/",
    capabilities: [
      {
        ...capability(
          "business_structure_read",
          "Read business structure",
          "Read a bounded connected-business summary and ledger-account classification metadata without accounts, balances, transactions, people, or writes.",
          true,
        ),
        platformCapability: "sage_accounting_business_structure_read",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl:
          "https://www.sageone.com/oauth2/auth/central?filter=apiv3.1",
        tokenUrl: "https://oauth.accounting.sage.com/token",
        userInfoUrl: "https://api.accounting.sage.com/v3.1/businesses",
        requiredScopes: ["full_access"],
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "SAGE_ACCOUNTING_CLIENT_ID",
          label: "Sage Accounting OAuth client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText:
            "Use the client ID from a customer-owned Sage Accounting developer application with Relay's exact Railway callback.",
        },
        {
          name: "SAGE_ACCOUNTING_CLIENT_SECRET",
          label: "Sage Accounting OAuth client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Store the customer-owned confidential client secret only through Relay's encrypted OAuth boundary.",
        },
        {
          name: "SAGE_ACCOUNTING_SUBSCRIPTION_KEY",
          label: "Sage Accounting API subscription key",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Use the primary or secondary APIM subscription key issued to the same customer-owned Sage developer application.",
        },
      ],
    },
    tools: [
      {
        name: "sage-accounting.getBusiness",
        functionName: "sage_accounting_business_get",
        aliases: [
          "sage-accounting.getBusiness",
          "sage_accounting_business_get",
        ],
        capability: "business_structure_read",
        platformCapability: "sage_accounting_business_structure_read",
        action: "read",
        approvalRequired: true,
        description:
          "Read one bounded summary for the exactly connected Sage Accounting business.",
        inputSchema: {
          type: "object",
          properties: { approvalId },
          additionalProperties: false,
        },
      },
      {
        name: "sage-accounting.listLedgerAccountClassifications",
        functionName: "sage_accounting_ledger_classification_list",
        aliases: [
          "sage-accounting.listLedgerAccountClassifications",
          "sage_accounting_ledger_classification_list",
        ],
        capability: "business_structure_read",
        platformCapability: "sage_accounting_business_structure_read",
        action: "read",
        approvalRequired: true,
        description:
          "List at most twenty-five ledger-account classifications from fixed page one.",
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
        name: "sage-accounting.getLedgerAccountClassification",
        functionName: "sage_accounting_ledger_classification_get",
        aliases: [
          "sage-accounting.getLedgerAccountClassification",
          "sage_accounting_ledger_classification_get",
        ],
        capability: "business_structure_read",
        platformCapability: "sage_accounting_business_structure_read",
        action: "read",
        approvalRequired: true,
        description: "Read one exact bounded ledger-account classification.",
        inputSchema: {
          type: "object",
          properties: {
            classificationId: {
              type: "string",
              pattern: "^[A-Za-z0-9_-]{1,200}$",
            },
            approvalId,
          },
          required: ["classificationId"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "sage_accounting_safe",
        label: "Safe",
        description:
          "All three private business-structure reads require approval.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: reads,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The three selected read-only tools run without Relay per-action approval while exact app, token, subscription key, business, origin, path, page, limit, redaction, audits, and provider permissions remain enforced.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "business",
        label:
          "Sage Accounting OAuth app, subscription key, exact business, and business-summary read validation",
      },
    ],
  };
