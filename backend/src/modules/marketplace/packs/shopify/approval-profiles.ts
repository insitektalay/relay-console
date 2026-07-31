import { action, blocked } from "../../catalog/marketplace-catalog.types";

const READ_ALLOWED = [
  action("read_catalog", "Read catalog", "Read products, variants, collections, product publication state, prices, and catalogue metadata."),
  action("read_orders_customers", "Read orders and customers", "Read orders, customers, refunds, returns, fulfillments, and protected customer data only when scopes allow and summaries minimize private data."),
  action("read_inventory", "Read inventory and fulfillment", "Read inventory items, inventory levels, locations, fulfillment orders, and fulfillment status."),
  action("summarize_shopify_state", "Summarize Shopify state", "Summarize catalogue, order, customer, inventory, fulfillment, refund, and webhook state for internal operators."),
];

const DRAFT_ALLOWED = [
  action("prepare_shopify_change", "Prepare Shopify change", "Draft exact GraphQL mutation or REST fallback details with object ids, location ids, quantity, amount/currency, customer impact, and approval request."),
];

const APPROVAL_REQUIRED = [
  action("change_catalog", "Change products variants collections or publication", "Creating or updating products, variants, collections, prices, product status, or publication affects the storefront and requires approval."),
  action("change_inventory_fulfillment", "Change inventory or fulfillment", "Inventory adjustments, fulfillment creation/cancellation, assigned fulfillment-order changes, and order-state changes require approval."),
  action("refund_return_order", "Refund or return order", "Refunds, returns, restocks, shipping refund decisions, and customer notifications require approval."),
  action("modify_webhooks", "Modify webhooks", "Creating, updating, deleting, or broadening webhook subscriptions requires approval."),
  action("export_customer_order_data", "Export customer or order data", "Customer/order exports carry protected customer data risk and require approval."),
];

const BLOCKED = [
  blocked("expose_shopify_secrets", "Expose Shopify secrets", "Never expose Admin access tokens, OAuth credentials, webhook signing secrets, or encrypted connection payloads."),
  blocked("access_raw_payment_data", "Access raw payment data", "Raw card or payment credentials are outside this pack and must never be requested or displayed."),
  blocked("broaden_scopes", "Broaden permissions", "Changing OAuth scopes, generating broader tokens, or expanding app permissions is blocked."),
  blocked("disable_security", "Disable fraud or security settings", "Disabling fraud, risk, or security controls is blocked."),
  blocked("change_legal_tax_business", "Change legal tax or business settings", "Legal, tax, payout, business, or compliance settings are blocked."),
  blocked("delete_core_records", "Delete shops customers orders or payment records", "Deleting shops, customers, orders, payment records, or destructive bulk catalogue/order actions is blocked."),
  blocked("unapproved_money_inventory_actions", "Unapproved money inventory or fulfillment actions", "Live refunds, restocks, inventory changes, fulfillment changes, or customer-facing order changes without approval are blocked."),
];

export const SHOPIFY_APPROVAL_PROFILES = [
  { id: "shopify_read_only", label: "Read Only", description: "Inspect Shopify Admin API state only.", defaultSelected: false, allowedActions: READ_ALLOWED, approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "shopify_safe_operator", label: "Safe Operator", description: "Default Shopify operator. Reads and drafts are allowed; live catalogue, order, inventory, fulfillment, refund, export, and webhook changes are approval-gated.", defaultSelected: true, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "shopify_manager_approval", label: "Manager Approval", description: "Allows approved Shopify writes after explicit review and audit context.", defaultSelected: false, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
  { id: "shopify_admin_high_risk", label: "Admin High Risk", description: "Administrative Shopify profile; destructive, permission, legal/tax, secret, and raw payment actions remain blocked.", defaultSelected: false, allowedActions: [...READ_ALLOWED, ...DRAFT_ALLOWED], approvalRequiredActions: APPROVAL_REQUIRED, blockedActions: BLOCKED },
];
