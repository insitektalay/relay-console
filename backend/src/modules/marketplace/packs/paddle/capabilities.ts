import { capability } from "../../catalog/marketplace-catalog.types";

export const PADDLE_CAPABILITIES = [
  capability("customers_read", "Customers Read", "Read Paddle customers, addresses, businesses, and billing identity with private fields minimized.", true),
  capability("catalog_read", "Products And Prices Read", "Read products, prices, discounts, tax category, recurring terms, and active status.", true),
  capability("billing_read", "Billing Read", "Read transactions, invoices, receipts, subscriptions, adjustments, credits, and renewal state.", true),
  capability("billing_draft", "Billing Draft", "Prepare exact transaction, subscription, refund, credit, price, or webhook plans without side effects.", true),
  capability("transactions_create", "Transactions Create", "Create transactions, invoices, or checkout/payment flows only after approval.", false),
  capability("subscriptions_manage", "Subscriptions Manage", "Update, pause, resume, or cancel subscriptions only after approval.", false),
  capability("adjustments_create", "Adjustments Create", "Create refunds, credits, or adjustments only after approval with verified transaction and amount.", false),
  capability("catalog_webhooks_manage", "Catalog And Webhooks Manage", "Change products, prices, discounts, or webhook/notification settings only after approval.", false),
];
