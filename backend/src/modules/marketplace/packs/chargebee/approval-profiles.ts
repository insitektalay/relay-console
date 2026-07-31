import { action, blocked } from "../../catalog/marketplace-catalog.types";

const READ_ALLOWED = [
  action("read_customers", "Read customers", "Read customers, billing profile, balances, and payment-source summaries with sensitive fields minimized."),
  action("read_subscriptions_invoices", "Read subscriptions and invoices", "Read subscriptions, items, lifecycle state, invoices, payments, transactions, credit notes, estimates, and hosted pages."),
  action("read_catalog_coupons", "Read items prices and coupons", "Read items, plan items, addon items, charge items, item prices, coupons, and price constraints."),
  action("summarize_chargebee_state", "Summarize Chargebee state", "Summarize billing lifecycle, invoice/payment/refund state, hosted-page state, test/live site context, events, and webhooks for internal operators."),
];

const DRAFT_ALLOWED = [
  action("prepare_chargebee_change", "Prepare Chargebee change", "Draft exact invoice, estimate, hosted-page, subscription, item price, coupon, refund, credit-note, or webhook changes without side effects."),
];

const APPROVAL_REQUIRED = [
  action("create_invoice_or_hosted_page", "Create invoice or hosted page", "Creating/sending/collecting invoices or hosted checkout/payment pages requires approval."),
  action("refund_credit_payment", "Refund credit or payment", "Refunds, credit notes, void/write-off actions, and payment-state changes require approval."),
  action("change_subscription", "Change subscription", "Creating, updating, cancelling, pausing, resuming, reactivating, or changing subscription items requires approval."),
  action("change_catalog_coupon", "Change item price plan or coupon", "Creating or updating item prices, plans, addons, charges, and coupons requires approval."),
  action("modify_webhooks", "Modify webhooks", "Creating, updating, deleting, or broadening webhook settings requires approval."),
  action("export_customer_billing_data", "Export customer billing data", "Customer billing exports require approval and minimization."),
];

const BLOCKED = [
  blocked("expose_chargebee_secrets", "Expose Chargebee secrets", "Never expose API keys, Basic Auth headers, webhook secrets, or encrypted connection payloads."),
  blocked("access_raw_card_data", "Access raw card data", "Raw card data is outside this pack; use hosted pages for payment method workflows."),
  blocked("delete_billing_records", "Delete billing records", "Deleting customers, subscriptions, invoices, payments, or legal financial records is blocked."),
  blocked("broaden_permissions", "Broaden permissions", "Creating broader keys or expanding permissions is blocked."),
  blocked("disable_security", "Disable fraud or security settings", "Disabling fraud, risk, webhook validation, or security controls is blocked."),
  blocked("change_tax_legal_business", "Change tax legal or business settings", "Tax, legal, business, payout, and compliance settings are blocked."),
  blocked("unapproved_money_or_subscription_action", "Unapproved money or subscription action", "Live money movement, hosted payment flow creation, or entitlement-affecting subscription change without approval is blocked."),
];

export const CHARGEBEE_APPROVAL_PROFILES = [
  { id: "chargebee_read_only", label: "Read Only", description: "Inspect Chargebee state only.", defaultSelected: false, allowedActions: READ_ALLOWED, approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "chargebee_safe_operator", label: "Safe Operator", description: "Default Chargebee operator. Reads and drafts are allowed; live invoice, hosted-page, payment, refund, subscription, item price, coupon, export, and webhook changes are approval-gated.", defaultSelected: true, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "chargebee_manager_approval", label: "Manager Approval", description: "Allows approved Chargebee writes after explicit review and audit context.", defaultSelected: false, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "chargebee_admin_high_risk", label: "Admin High Risk", description: "Administrative Chargebee profile; destructive, permission, tax/legal, secret, raw card, and unapproved billing actions remain blocked.", defaultSelected: false, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
];
