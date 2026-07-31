import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "kashflow_currency_list",
    "List configured currencies",
    "List at most twenty-five bounded currency-code, name, symbol, and display-position summaries configured for the connected KashFlow account.",
  ),
  action(
    "kashflow_vat_registration_get",
    "Read VAT-registration status",
    "Read only whether the connected KashFlow account is marked as VAT registered.",
  ),
];
const blockedActions = [
  blocked(
    "kashflow_record_mutation",
    "Change KashFlow data",
    "Creating, updating, deleting, emailing, allocating, importing, or otherwise changing KashFlow records is outside V1.",
  ),
  blocked(
    "kashflow_private_business_data",
    "Read private business data",
    "Company details, users, customers, suppliers, contacts, addresses, communications, notes, files, and custom data are outside V1.",
  ),
  blocked(
    "kashflow_financial_and_broader_product",
    "Access financial or broader KashFlow data",
    "Accounts, balances, ledgers, journals, invoices, quotes, purchases, payments, banking, tax rates or reports, payroll, inventory, products, projects, and administration are outside V1.",
  ),
  blocked(
    "kashflow_raw_api",
    "Call arbitrary KashFlow APIs",
    "Other origins, SOAP methods, REST v2, fields, parameters, methods, XML, WSDL operations, and raw requests are outside V1.",
  ),
  blocked(
    "kashflow_bulk_export",
    "Export KashFlow data",
    "Pagination, polling, crawling, synchronization, attachments, PDFs, CSVs, downloads, imports, and broad exports are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const KASHFLOW_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "kashflow",
  name: "KashFlow",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.kashflow.com/developers/soap-api/",
  providerWebsiteUrl: "https://www.kashflow.com/",
  capabilities: [
    {
      ...capability(
        "account_configuration_read",
        "Read account configuration",
        "Read only bounded currency presentation metadata and VAT-registration status without exchange rates, business identity, accounting records, or writes.",
        true,
      ),
      platformCapability: "kashflow_account_configuration_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "KASHFLOW_USERNAME",
        label: "KashFlow username",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated least-privilege KashFlow user for the exact intended account.",
      },
      {
        name: "KASHFLOW_API_PASSWORD",
        label: "KashFlow separate API password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Enable SOAP API access and configure a separate API password instead of the normal web-login password.",
      },
    ],
  },
  tools: [
    {
      name: "kashflow.listCurrencies",
      functionName: "kashflow_currency_list",
      aliases: ["kashflow.listCurrencies", "kashflow_currency_list"],
      capability: "account_configuration_read",
      platformCapability: "kashflow_account_configuration_read",
      action: "read",
      approvalRequired: true,
      description:
        "List at most twenty-five configured currency presentation summaries without exchange rates.",
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
      name: "kashflow.getVatRegistration",
      functionName: "kashflow_vat_registration_get",
      aliases: ["kashflow.getVatRegistration", "kashflow_vat_registration_get"],
      capability: "account_configuration_read",
      platformCapability: "kashflow_account_configuration_read",
      action: "read",
      approvalRequired: true,
      description:
        "Read only whether the connected account is marked as VAT registered.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "kashflow_safe",
      label: "Safe",
      description: "Both private account-configuration reads require approval.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Both selected read-only tools run without Relay per-action approval while the exact account, origin, SOAP action, method, field, limit, redaction, audit, and provider-permission boundaries remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "vat-registration",
      label:
        "KashFlow API enablement, dedicated-user credentials, and bounded VAT-registration validation",
    },
  ],
};
