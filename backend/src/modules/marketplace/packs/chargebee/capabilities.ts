import { capability } from "../../catalog/marketplace-catalog.types";

export const CHARGEBEE_CAPABILITIES = [
  capability("customers_read", "Customers Read", "Read Chargebee customers, billing profile, payment-source summaries, and customer balance with sensitive fields minimized.", true),
  capability("subscriptions_read", "Subscriptions Read", "Read subscriptions, items, lifecycle state, invoices, estimates, hosted pages, and entitlement-relevant billing state.", true),
  capability("catalog_read", "Items Prices Read", "Read items, plan items, addon items, charge items, item prices, coupons, and price constraints.", true),
  capability("billing_draft", "Billing Draft", "Prepare invoice, estimate, hosted-page, subscription, item price, coupon, refund, or credit-note plans without side effects.", true),
  capability("subscriptions_manage", "Subscriptions Manage", "Create, update, cancel, pause, resume, reactivate, or change subscription items only after approval.", false),
  capability("invoices_payments_manage", "Invoices Payments Manage", "Create/send/collect invoices, issue credits/refunds, or change invoice/payment state only after approval.", false),
  capability("catalog_coupons_manage", "Catalog Coupons Manage", "Create or update item prices, plans, addons, charges, and coupons only after approval.", false),
  capability("hosted_pages_webhooks_manage", "Hosted Pages Webhooks Manage", "Create hosted checkout/payment pages or modify webhook settings only after approval.", false),
];
