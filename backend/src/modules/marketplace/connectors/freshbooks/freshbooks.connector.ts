import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const FRESHBOOKS_SCOPES = ["user:profile:read", "user:invoices:read"];

const membershipRead = action(
  "freshbooks_business_memberships_list",
  "Read connected business",
  "Read bounded identifiers and role for the exact connected FreshBooks business.",
);
const invoiceReads = [
  action(
    "freshbooks_invoice_list",
    "List invoices",
    "List at most twenty-five privacy-redacted invoice summaries.",
  ),
  action(
    "freshbooks_invoice_get",
    "Read invoice",
    "Read one exact privacy-redacted invoice summary by numeric ID.",
  ),
];
const blockedActions = [
  blocked(
    "freshbooks_financial_write",
    "Change accounting records",
    "Invoice, payment, expense, project, time, client, and broader accounting writes are outside V1.",
  ),
  blocked(
    "freshbooks_private_data",
    "Read private accounting data",
    "Profile and client identity, contact details, addresses, notes, terms, invoice lines, payment details, and raw errors are outside V1.",
  ),
  blocked(
    "freshbooks_broader_accounting",
    "Access broader accounting",
    "Payments, bills, expenses, journals, reports, tax, projects, time, teams, and administration are outside V1.",
  ),
  blocked(
    "freshbooks_raw_api",
    "Use arbitrary FreshBooks APIs",
    "Arbitrary paths, parameters, includes, automatic pagination, and raw API access are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const FRESHBOOKS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "freshbooks",
  name: "FreshBooks",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.freshbooks.com/api/authentication",
  providerWebsiteUrl: "https://www.freshbooks.com/",
  capabilities: [
    {
      ...capability(
        "business_membership_read",
        "Read business membership",
        "Read the bounded role and identifiers for the exact connected business without profile identity data.",
        true,
      ),
      platformCapability: "freshbooks_business_membership_read",
    },
    {
      ...capability(
        "invoice_read",
        "Read invoices",
        "List bounded redacted invoice summaries or inspect one exact invoice.",
        true,
      ),
      platformCapability: "freshbooks_invoice_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://auth.freshbooks.com/oauth/authorize/",
      tokenUrl: "https://api.freshbooks.com/auth/oauth/token",
      refreshUrl: "https://api.freshbooks.com/auth/oauth/token",
      revocationUrl: "https://api.freshbooks.com/auth/oauth/revoke",
      requiredScopes: FRESHBOOKS_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "freshbooks.getConnectedBusiness",
      functionName: "freshbooks_business_memberships_list",
      aliases: [
        "freshbooks.getConnectedBusiness",
        "freshbooks_business_memberships_list",
      ],
      capability: "business_membership_read",
      platformCapability: "freshbooks_business_membership_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read bounded identifiers and role for the exact connected business.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "freshbooks.listInvoices",
      functionName: "freshbooks_invoice_list",
      aliases: ["freshbooks.listInvoices", "freshbooks_invoice_list"],
      capability: "invoice_read",
      platformCapability: "freshbooks_invoice_read",
      action: "read",
      approvalRequired: true,
      description: "List at most twenty-five redacted invoice summaries.",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1, maximum: 10000 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "freshbooks.getInvoice",
      functionName: "freshbooks_invoice_get",
      aliases: ["freshbooks.getInvoice", "freshbooks_invoice_get"],
      capability: "invoice_read",
      platformCapability: "freshbooks_invoice_read",
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
      id: "freshbooks_safe",
      label: "Safe",
      description:
        "Connected-business metadata runs directly; invoice reads require matching approval.",
      defaultSelected: true,
      allowedActions: [membershipRead],
      approvalRequiredActions: invoiceReads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact-business binding, bounds, audit, redaction, rolling refresh, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [membershipRead, ...invoiceReads],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "business",
      label: "FreshBooks authorization and exact business validation",
      requiredScopes: FRESHBOOKS_SCOPES,
    },
  ],
};
