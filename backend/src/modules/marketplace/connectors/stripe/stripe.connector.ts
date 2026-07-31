import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const STRIPE_APP_PERMISSIONS = ["balance_read", "payment_intent_read"];

const balance = action(
  "stripe_balance_get",
  "Read balance",
  "Read available and pending integer amount and currency buckets for the connected account.",
);
const paymentReads = [
  action(
    "stripe_payment_intent_list",
    "List payment status",
    "Read up to twenty-five privacy-redacted PaymentIntent status summaries.",
  ),
  action(
    "stripe_payment_intent_get",
    "Read payment status",
    "Read one exact privacy-redacted PaymentIntent status summary.",
  ),
];
const blockedActions = [
  blocked(
    "stripe_payment_mutation",
    "Change financial state",
    "Payments, refunds, transfers, and payouts are outside V1.",
  ),
  blocked(
    "stripe_private_financial_data",
    "Read private financial data",
    "Customers, payment methods, receipts, shipping, files, evidence, and raw errors are outside V1.",
  ),
  blocked(
    "stripe_broader_admin",
    "Administer Stripe",
    "Billing, catalog, Connect, events, reports, settings, and broader administration are outside V1.",
  ),
  blocked(
    "stripe_raw_api",
    "Use arbitrary Stripe APIs",
    "Arbitrary paths, parameters, expansions, automatic pagination, and raw API access are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const tool = (
  name: string,
  functionName: string,
  capabilityName: string,
  approvalRequired: boolean,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({
  name,
  functionName,
  aliases: [name, functionName],
  capability: capabilityName,
  platformCapability: `stripe_${capabilityName}`,
  action: "read" as const,
  approvalRequired,
  description,
  inputSchema: {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  },
});

export const STRIPE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "stripe",
  name: "Stripe",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.stripe.com/stripe-apps/api-authentication/oauth",
  providerWebsiteUrl: "https://stripe.com/",
  capabilities: [
    {
      ...capability(
        "balance_read",
        "Read balances",
        "Read available and pending integer minor-unit balances by currency.",
        true,
      ),
      platformCapability: "stripe_balance_read",
    },
    {
      ...capability(
        "payment_intent_read",
        "Read payment status",
        "List bounded redacted PaymentIntent status or inspect one exact PaymentIntent.",
        true,
      ),
      platformCapability: "stripe_payment_intent_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://marketplace.stripe.com/oauth/v2/authorize",
      tokenUrl: "https://api.stripe.com/v1/oauth/token",
      refreshUrl: "https://api.stripe.com/v1/oauth/token",
      requiredScopes: STRIPE_APP_PERMISSIONS,
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "STRIPE_APPS_CLIENT_ID",
        label: "Stripe App client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText: "Relay Console public Stripe App OAuth client ID.",
      },
      {
        name: "STRIPE_APPS_DEVELOPER_SECRET_KEY",
        label: "Stripe App developer secret key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "The matching app-developer mode key used only by Railway for OAuth token exchange and refresh.",
      },
    ],
  },
  tools: [
    tool(
      "stripe.getBalance",
      "stripe_balance_get",
      "balance_read",
      false,
      "Read available and pending balance buckets.",
      {},
    ),
    tool(
      "stripe.listPaymentIntents",
      "stripe_payment_intent_list",
      "payment_intent_read",
      true,
      "Read up to twenty-five privacy-redacted PaymentIntent status summaries.",
      {
        limit: { type: "integer", minimum: 1, maximum: 25 },
        startingAfter: {
          type: "string",
          minLength: 4,
          maxLength: 128,
          pattern: "^pi_[A-Za-z0-9]+$",
        },
        createdGte: { type: "integer", minimum: 1 },
        createdLte: { type: "integer", minimum: 1 },
        status: {
          type: "string",
          enum: [
            "requires_payment_method",
            "requires_confirmation",
            "requires_action",
            "processing",
            "requires_capture",
            "canceled",
            "succeeded",
          ],
        },
        approvalId,
      },
    ),
    tool(
      "stripe.getPaymentIntent",
      "stripe_payment_intent_get",
      "payment_intent_read",
      true,
      "Read one exact privacy-redacted PaymentIntent status summary.",
      {
        paymentIntentId: {
          type: "string",
          minLength: 4,
          maxLength: 128,
          pattern: "^pi_[A-Za-z0-9]+$",
        },
        approvalId,
      },
      ["paymentIntentId"],
    ),
  ],
  approvalProfiles: [
    {
      id: "stripe_safe",
      label: "Safe",
      description:
        "Balance reads run directly; privacy-sensitive PaymentIntent status reads require matching approval.",
      defaultSelected: true,
      allowedActions: [balance],
      approvalRequiredActions: paymentReads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while account authority, app permissions, bounds, audit, redaction, refresh rotation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [balance, ...paymentReads],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "balance",
      label:
        "Stripe account authorization and installed-app permission validation",
      requiredScopes: STRIPE_APP_PERMISSIONS,
    },
  ],
};
