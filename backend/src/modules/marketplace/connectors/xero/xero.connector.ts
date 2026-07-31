import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const XERO_SCOPES = [
  "offline_access",
  "accounting.settings.read",
  "accounting.invoices.read",
];

const organisationRead = action(
  "xero_organisation_get",
  "Read organisation",
  "Read the exact connected Xero organisation's bounded accounting metadata.",
);
const invoiceReads = [
  action(
    "xero_invoice_list",
    "List invoices",
    "List at most twenty-five privacy-redacted invoice summaries.",
  ),
  action(
    "xero_invoice_get",
    "Read invoice",
    "Read one exact privacy-redacted invoice summary by UUID.",
  ),
];
const blockedActions = [
  blocked(
    "xero_financial_write",
    "Change financial records",
    "Invoice, payment, contact, bank, journal, asset, payroll, and settings writes are outside V1.",
  ),
  blocked(
    "xero_private_data",
    "Read private accounting data",
    "Contact identity, line items, references, payments, attachments, bank data, payroll, reports, and raw errors are outside V1.",
  ),
  blocked(
    "xero_broader_admin",
    "Administer Xero",
    "Users, connections, subscriptions, tax administration, and broader organisation administration are outside V1.",
  ),
  blocked(
    "xero_raw_api",
    "Use arbitrary Xero APIs",
    "Arbitrary paths, parameters, automatic pagination, and raw Xero API access are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const XERO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "xero",
  name: "Xero",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.xero.com/documentation/guides/oauth2/auth-flow",
  providerWebsiteUrl: "https://www.xero.com/",
  capabilities: [
    {
      ...capability(
        "organisation_read",
        "Read organisation",
        "Read bounded metadata for the exact connected organisation.",
        true,
      ),
      platformCapability: "xero_organisation_read",
    },
    {
      ...capability(
        "invoice_read",
        "Read invoices",
        "List bounded redacted invoice summaries or inspect one exact invoice.",
        true,
      ),
      platformCapability: "xero_invoice_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://login.xero.com/identity/connect/authorize",
      tokenUrl: "https://identity.xero.com/connect/token",
      refreshUrl: "https://identity.xero.com/connect/token",
      revocationUrl: "https://identity.xero.com/connect/revocation",
      requiredScopes: XERO_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "XERO_CLIENT_ID",
        label: "Xero client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Client ID from a Xero Web app owned by your business.",
      },
      {
        name: "XERO_CLIENT_SECRET",
        label: "Xero client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Matching client secret, encrypted and used only for OAuth exchange, refresh, and revocation.",
      },
    ],
  },
  tools: [
    {
      name: "xero.getOrganisation",
      functionName: "xero_organisation_get",
      aliases: ["xero.getOrganisation", "xero_organisation_get"],
      capability: "organisation_read",
      platformCapability: "xero_organisation_read",
      action: "read",
      approvalRequired: false,
      description: "Read the exact connected organisation's bounded metadata.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "xero.listInvoices",
      functionName: "xero_invoice_list",
      aliases: ["xero.listInvoices", "xero_invoice_list"],
      capability: "invoice_read",
      platformCapability: "xero_invoice_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty-five redacted invoice summaries.",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          status: {
            type: "string",
            enum: [
              "DRAFT",
              "SUBMITTED",
              "AUTHORISED",
              "PAID",
              "VOIDED",
              "DELETED",
            ],
          },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "xero.getInvoice",
      functionName: "xero_invoice_get",
      aliases: ["xero.getInvoice", "xero_invoice_get"],
      capability: "invoice_read",
      platformCapability: "xero_invoice_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact redacted invoice summary.",
      inputSchema: {
        type: "object",
        properties: {
          invoiceId: { type: "string", format: "uuid" },
          approvalId,
        },
        required: ["invoiceId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "xero_safe",
      label: "Safe",
      description:
        "Organisation metadata runs directly; invoice reads require matching approval.",
      defaultSelected: true,
      allowedActions: [organisationRead],
      approvalRequiredActions: invoiceReads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while organisation binding, scopes, bounds, audit, redaction, refresh rotation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [organisationRead, ...invoiceReads],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "organisation",
      label: "Xero organisation authorization and exact tenant validation",
      requiredScopes: XERO_SCOPES,
    },
  ],
};
