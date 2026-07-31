import { action, blocked } from "../../catalog/marketplace-catalog.types";

const READ_ALLOWED = [
  action("read_customers", "Read customers", "Read customers, addresses, businesses, marketing consent, and billing identity with private fields minimized."),
  action("read_catalog", "Read products prices and discounts", "Read products, prices, recurring terms, tax category, discounts, and active status."),
  action("read_billing", "Read billing state", "Read transactions, invoices, receipts, subscriptions, adjustments, credits, renewal dates, and payment status."),
  action("summarize_paddle_state", "Summarize Paddle state", "Summarize sandbox/live billing, transaction, subscription, invoice, product, price, and webhook state for internal operators."),
];

const DRAFT_ALLOWED = [
  action("prepare_paddle_change", "Prepare Paddle change", "Draft exact transaction, subscription, adjustment, product, price, discount, or webhook changes without side effects."),
];

const APPROVAL_REQUIRED = [
  action("create_transaction_invoice_checkout", "Create transaction invoice or checkout", "Transactions, invoices, and checkout/payment links can collect money and require approval."),
  action("refund_credit_adjustment", "Refund credit or adjustment", "Adjustments, refunds, and credits against billed/completed transactions require approval."),
  action("change_subscription", "Change subscription", "Updating, pausing, resuming, cancelling, or immediately charging subscriptions requires approval."),
  action("change_catalog_discount", "Change catalog price or discount", "Product, price, discount, or customer-facing billing changes require approval."),
  action("modify_webhooks", "Modify webhooks", "Creating, updating, or deleting notification settings/webhooks requires approval."),
];

const BLOCKED = [
  blocked("expose_paddle_secrets", "Expose Paddle secrets", "Never expose Paddle API keys, webhook secrets, bearer headers, or encrypted connection payloads."),
  blocked("access_raw_payment_data", "Access raw payment data", "Raw card or payment credentials are outside this pack and must never be requested or displayed."),
  blocked("disable_security", "Disable fraud or security settings", "Disabling fraud, risk, or security controls is blocked."),
  blocked("broaden_permissions", "Broaden permissions", "Creating broader API keys or expanding Paddle key permissions is blocked."),
  blocked("change_tax_legal_business", "Change tax legal or business settings", "Tax, legal, merchant-of-record, payout, and business settings are blocked."),
  blocked("delete_financial_records", "Delete financial records", "Deleting customer, transaction, subscription, invoice, payment, or legal financial records is blocked."),
  blocked("unapproved_money_movement", "Unapproved money movement", "Live charges, refunds, credits, or subscription money movement without explicit approval are blocked."),
];

export const PADDLE_APPROVAL_PROFILES = [
  { id: "paddle_read_only", label: "Read Only", description: "Inspect Paddle state only.", defaultSelected: false, allowedActions: READ_ALLOWED, approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "paddle_safe_operator", label: "Safe Operator", description: "Default Paddle operator. Reads and drafts are allowed; live money, subscription, product, price, discount, and webhook changes are approval-gated.", defaultSelected: true, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "paddle_manager_approval", label: "Manager Approval", description: "Allows approved Paddle writes after explicit review and audit context.", defaultSelected: false, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "paddle_admin_high_risk", label: "Admin High Risk", description: "Administrative Paddle profile; destructive, permission, tax/legal, secret, and raw payment actions remain blocked.", defaultSelected: false, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
];
