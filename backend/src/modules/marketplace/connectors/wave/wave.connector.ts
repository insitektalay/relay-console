import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const WAVE_SCOPES = ["business:read", "invoice:read"];

const businessRead = action(
  "wave_business_get",
  "Read connected business",
  "Read bounded metadata for the exact connected Wave business.",
);
const invoiceReads = [
  action(
    "wave_invoice_list",
    "List invoices",
    "List at most twenty-five privacy-redacted invoice summaries.",
  ),
  action(
    "wave_invoice_get",
    "Read invoice",
    "Read one exact privacy-redacted invoice summary by opaque ID.",
  ),
];
const blockedActions = [
  blocked(
    "wave_invoice_mutation",
    "Change invoices",
    "Creating, updating, sending, deleting, or otherwise changing invoices is outside V1.",
  ),
  blocked(
    "wave_private_accounting",
    "Read private accounting data",
    "Customer identity, line items, tax, memos, URLs, payment details, and send or view history are outside V1.",
  ),
  blocked(
    "wave_broader_accounting",
    "Access broader accounting",
    "Accounts, products, sales tax, transactions, vendors, estimates, user identity, and administration are outside V1.",
  ),
  blocked(
    "wave_payment_wallet",
    "Use payment-wallet APIs",
    "Wave's separate checkout, payout, reconciliation, and payment-wallet APIs are outside V1.",
  ),
  blocked(
    "wave_raw_graphql",
    "Use arbitrary GraphQL",
    "Arbitrary queries, mutations, introspection, automatic pagination, and raw GraphQL access are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const opaqueId = { type: "string", pattern: "^[A-Za-z0-9+/=_-]{1,256}$" };

export const WAVE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "wave",
  name: "Wave",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.waveapps.com/hc/en-us/articles/360019493652-OAuth-Guide",
  providerWebsiteUrl: "https://www.waveapps.com/",
  capabilities: [
    {
      ...capability(
        "business_read",
        "Read business",
        "Read bounded metadata for the exact connected Wave business.",
        true,
      ),
      platformCapability: "wave_business_read",
    },
    {
      ...capability(
        "invoice_read",
        "Read invoices",
        "List bounded redacted invoice summaries or inspect one exact invoice.",
        true,
      ),
      platformCapability: "wave_invoice_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://api.waveapps.com/oauth2/authorize/",
      tokenUrl: "https://api.waveapps.com/oauth2/token/",
      refreshUrl: "https://api.waveapps.com/oauth2/token/",
      revocationUrl: "https://api.waveapps.com/oauth2/token-revoke/",
      requiredScopes: WAVE_SCOPES,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [],
  },
  tools: [
    {
      name: "wave.getConnectedBusiness",
      functionName: "wave_business_get",
      aliases: ["wave.getConnectedBusiness", "wave_business_get"],
      capability: "business_read",
      platformCapability: "wave_business_read",
      action: "read",
      approvalRequired: false,
      description: "Read bounded metadata for the exact connected business.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "wave.listInvoices",
      functionName: "wave_invoice_list",
      aliases: ["wave.listInvoices", "wave_invoice_list"],
      capability: "invoice_read",
      platformCapability: "wave_invoice_read",
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
      name: "wave.getInvoice",
      functionName: "wave_invoice_get",
      aliases: ["wave.getInvoice", "wave_invoice_get"],
      capability: "invoice_read",
      platformCapability: "wave_invoice_read",
      action: "read",
      approvalRequired: true,
      description: "Read one exact redacted invoice summary.",
      inputSchema: {
        type: "object",
        properties: { invoiceId: opaqueId, approvalId },
        required: ["invoiceId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "wave_safe",
      label: "Safe",
      description:
        "Connected-business metadata runs directly; invoice reads require matching approval.",
      defaultSelected: true,
      allowedActions: [businessRead],
      approvalRequiredActions: invoiceReads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact-business binding, bounds, audit, redaction, token refresh, subscription limits, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [businessRead, ...invoiceReads],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "business",
      label: "Wave authorization and exact business validation",
      requiredScopes: WAVE_SCOPES,
    },
  ],
};
