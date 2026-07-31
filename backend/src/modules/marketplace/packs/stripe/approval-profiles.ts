import {
  action,
  blocked,
  type MarketplaceActionPolicy,
  type MarketplaceApprovalProfile,
} from "../../catalog/marketplace-catalog.types";

export type StripeApprovalProfilePolicy = MarketplaceApprovalProfile & {
  allowedActions: MarketplaceActionPolicy[];
  approvalRequiredActions: MarketplaceActionPolicy[];
  blockedActions: MarketplaceActionPolicy[];
};

const READ_ALLOWED = [
  action(
    "read_customers",
    "Read customers",
    "Inspect customer identity, metadata, billing status, invoice history, and subscription status.",
  ),
  action(
    "read_invoices",
    "Read invoices",
    "Inspect invoice status, amounts, due dates, payment attempts, and hosted invoice links.",
  ),
  action(
    "read_subscriptions",
    "Read subscriptions",
    "Inspect subscription status, items, renewal dates, trial state, and cancellation state.",
  ),
  action(
    "read_products_prices",
    "Read products and prices",
    "Inspect product and price configuration before drafting billing actions.",
  ),
  action(
    "read_disputes_balance",
    "Read disputes and balance",
    "Inspect dispute status, evidence deadlines, balance, and transaction context.",
  ),
];

const SAFE_DRAFT_ALLOWED = [
  action(
    "create_draft_invoice",
    "Create draft invoice",
    "Create draft invoice and invoice item records without finalizing, sending, or collecting payment.",
  ),
  action(
    "create_internal_summary",
    "Create internal summary",
    "Summarize payment, customer, invoice, or subscription state for internal operators.",
  ),
  action(
    "prepare_change_plan",
    "Prepare billing change plan",
    "Draft the exact proposed billing operation, risk, affected customer, amount, and approval request.",
  ),
];

const MONEY_APPROVAL = [
  action(
    "send_invoice",
    "Send or finalize invoice",
    "Finalizing, sending, paying, voiding, or marking invoices uncollectible changes billing state and requires approval.",
  ),
  action(
    "create_payment_link",
    "Create live payment link",
    "Payment links expose a checkout flow and can collect money, so they require approval.",
  ),
  action(
    "create_refund",
    "Issue refund",
    "Refunds move money and require approval with verified payment, amount, reason, and customer context.",
  ),
  action(
    "change_subscription",
    "Change subscription",
    "Creating, updating, pausing, resuming, migrating, or canceling subscriptions requires approval.",
  ),
  action(
    "update_customer_billing",
    "Update customer billing details",
    "Changing customer billing identifiers, invoice settings, tax IDs, or payment settings requires approval.",
  ),
  action(
    "change_products_prices",
    "Change products or prices",
    "Product and price changes affect checkout and recurring billing and require approval.",
  ),
  action(
    "modify_webhook_endpoint",
    "Modify webhook endpoint",
    "Creating, updating, disabling, or deleting webhook endpoints requires approval.",
  ),
];

const COMMON_BLOCKED = [
  blocked(
    "delete_customer_records",
    "Delete customer records",
    "Customer deletion is blocked for marketplace-operated Stripe packs.",
  ),
  blocked(
    "expose_payment_data_or_secrets",
    "Expose payment data or secrets",
    "Never expose API keys, restricted keys, webhook signing secrets, raw card data, client secrets, or encrypted secret payloads.",
  ),
  blocked(
    "disable_fraud_or_security",
    "Disable fraud or security settings",
    "Disabling Radar, fraud checks, security settings, or comparable protections is blocked.",
  ),
  blocked(
    "change_tax_legal_business_settings",
    "Change tax, legal, or business settings",
    "Business profile, tax, legal entity, payout, and compliance settings are blocked in this pack.",
  ),
  blocked(
    "grant_broader_permissions",
    "Grant broader permissions",
    "Creating broader API keys, changing connection permissions, or expanding scopes is blocked.",
  ),
  blocked(
    "access_raw_card_data",
    "Access raw card data",
    "Raw card numbers, CVC, or full payment method secrets must never be requested, stored, or displayed.",
  ),
  blocked(
    "unapproved_money_movement",
    "Unapproved money movement",
    "Charging, refunding, payout changes, or other financial state changes without approval are blocked.",
  ),
];

export const STRIPE_APPROVAL_PROFILES: StripeApprovalProfilePolicy[] = [
  {
    id: "stripe_read_only",
    label: "Read Only",
    description:
      "Inspect Stripe state only. No customer, invoice, subscription, payment link, refund, product, price, or webhook writes.",
    defaultSelected: false,
    allowedActions: READ_ALLOWED,
    approvalRequiredActions: MONEY_APPROVAL,
    blockedActions: COMMON_BLOCKED,
  },
  {
    id: "stripe_safe_operator",
    label: "Safe Operator",
    description:
      "Default Stripe operator. Reads payment and billing state, drafts invoice work, and escalates all live money movement.",
    defaultSelected: true,
    allowedActions: [...READ_ALLOWED, ...SAFE_DRAFT_ALLOWED],
    approvalRequiredActions: MONEY_APPROVAL,
    blockedActions: COMMON_BLOCKED,
  },
  {
    id: "stripe_manager_approval",
    label: "Manager Approval",
    description:
      "Permits prepared billing operations only when a marketplace approval exists. Destructive, compliance, and secret exposure actions remain blocked.",
    defaultSelected: false,
    allowedActions: [...READ_ALLOWED, ...SAFE_DRAFT_ALLOWED],
    approvalRequiredActions: MONEY_APPROVAL,
    blockedActions: COMMON_BLOCKED,
  },
  {
    id: "stripe_admin_high_risk",
    label: "Admin High Risk",
    description:
      "For tightly controlled Stripe administration. High-risk operations still require explicit approval and audit context.",
    defaultSelected: false,
    allowedActions: [
      ...READ_ALLOWED,
      ...SAFE_DRAFT_ALLOWED,
      action(
        "inspect_webhooks",
        "Inspect webhook endpoints",
        "Read webhook endpoint configuration, delivery health, and subscribed events.",
      ),
    ],
    approvalRequiredActions: MONEY_APPROVAL,
    blockedActions: COMMON_BLOCKED,
  },
];

export function resolveStripeApprovalProfile(profileId?: string | null) {
  return (
    STRIPE_APPROVAL_PROFILES.find((profile) => profile.id === profileId) ??
    STRIPE_APPROVAL_PROFILES.find((profile) => profile.defaultSelected) ??
    STRIPE_APPROVAL_PROFILES[0]
  );
}
