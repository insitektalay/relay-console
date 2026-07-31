import { capability } from "../../catalog/marketplace-catalog.types";

export const LEMON_SQUEEZY_CAPABILITIES = [
  capability("store_catalog_read", "Store Catalog Read", "Read stores, products, variants, prices, files, and checkout-facing catalogue state.", true),
  capability("orders_customers_read", "Orders And Customers Read", "Read orders, customers, subscription invoices, discount redemptions, and minimized customer/order data.", true),
  capability("subscriptions_licenses_read", "Subscriptions Licenses Read", "Read subscriptions, subscription items, usage records, license keys, and license key instances.", true),
  capability("commerce_draft", "Commerce Draft", "Prepare checkout, discount, subscription, refund, license, file, or webhook change plans without side effects.", true),
  capability("checkouts_discounts_manage", "Checkouts Discounts Manage", "Create checkout links or discounts only after approval.", false),
  capability("subscriptions_manage", "Subscriptions Manage", "Update, pause, resume, cancel, or invoice subscriptions only after approval.", false),
  capability("refunds_licenses_manage", "Refunds Licenses Manage", "Refund orders or subscription invoices and modify license entitlements only after approval.", false),
  capability("webhooks_manage", "Webhooks Manage", "Create, update, or delete webhooks only after approval.", false),
];
