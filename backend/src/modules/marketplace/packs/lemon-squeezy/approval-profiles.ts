import { action, blocked } from "../../catalog/marketplace-catalog.types";

const READ_ALLOWED = [
  action("read_store_catalog", "Read stores products variants files", "Read stores, products, variants, prices, files, and checkout-facing catalogue state."),
  action("read_orders_customers", "Read orders and customers", "Read orders, customers, subscription invoices, discount redemptions, and minimized customer/order data."),
  action("read_subscriptions_licenses", "Read subscriptions and licenses", "Read subscriptions, subscription items, usage records, license keys, license key instances, and entitlement state."),
  action("summarize_lemon_squeezy_state", "Summarize Lemon Squeezy state", "Summarize commerce, subscription, license, file/download, discount, checkout, and webhook state for internal operators."),
];

const DRAFT_ALLOWED = [
  action("prepare_lemon_squeezy_change", "Prepare Lemon Squeezy change", "Draft exact checkout, discount, subscription, refund, license, file, or webhook changes without side effects."),
];

const APPROVAL_REQUIRED = [
  action("create_checkout", "Create checkout", "Checkout links and custom-priced checkout sessions can collect money and require approval."),
  action("refund_order_or_invoice", "Refund order or subscription invoice", "Order and subscription invoice refunds require approval with amount, reason, and customer impact."),
  action("change_subscription", "Change subscription", "Updating, pausing, resuming, cancelling, invoicing, or recording usage on subscriptions requires approval."),
  action("change_discount_catalog_files", "Change discounts catalog or files", "Creating/deleting discounts, changing variants, files, downloads, prices, or checkout-facing catalogue state requires approval."),
  action("modify_license_entitlement", "Modify license entitlement", "Updating license keys, activation limits, or activation state requires approval."),
  action("modify_webhooks", "Modify webhooks", "Creating, updating, or deleting webhooks requires approval."),
];

const BLOCKED = [
  blocked("expose_lemon_squeezy_secrets", "Expose Lemon Squeezy secrets", "Never expose API keys, webhook signing secrets, full license keys when a short key is enough, or encrypted connection payloads."),
  blocked("access_raw_payment_data", "Access raw payment data", "Raw card or payment credentials are outside this pack and must never be requested or displayed."),
  blocked("delete_financial_records", "Delete customer order or payment records", "Deleting customer, order, subscription, payment, or legal financial records is blocked."),
  blocked("broaden_permissions", "Broaden permissions", "Creating broader keys or expanding permissions is blocked."),
  blocked("disable_security", "Disable fraud or security settings", "Disabling fraud, risk, webhook validation, or security controls is blocked."),
  blocked("change_tax_legal_business", "Change tax legal or business settings", "Tax, legal, merchant, payout, and business settings are blocked."),
  blocked("unapproved_entitlement_money_action", "Unapproved money or entitlement action", "Live refunds, checkout creation, license revocation, or subscription entitlement changes without approval are blocked."),
];

export const LEMON_SQUEEZY_APPROVAL_PROFILES = [
  { id: "lemon-squeezy_read_only", label: "Read Only", description: "Inspect Lemon Squeezy state only.", defaultSelected: false, allowedActions: READ_ALLOWED, approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "lemon-squeezy_safe_operator", label: "Safe Operator", description: "Default Lemon Squeezy operator. Reads and drafts are allowed; checkout, refund, subscription, license, discount, catalogue, file, and webhook changes are approval-gated.", defaultSelected: true, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "lemon-squeezy_manager_approval", label: "Manager Approval", description: "Allows approved Lemon Squeezy writes after explicit review and audit context.", defaultSelected: false, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "lemon-squeezy_admin_high_risk", label: "Admin High Risk", description: "Administrative Lemon Squeezy profile; destructive, permission, tax/legal, secret, raw payment, and unapproved entitlement actions remain blocked.", defaultSelected: false, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
];
