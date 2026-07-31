import { capability } from "../../catalog/marketplace-catalog.types";

export const SHOPIFY_CAPABILITIES = [
  capability("catalog_read", "Catalog Read", "Read products, variants, collections, product status, prices, and published catalogue state.", true),
  capability("orders_customers_read", "Orders And Customers Read", "Read orders, customers, refunds, returns, fulfillments, and protected customer data only when scopes allow.", true),
  capability("inventory_read", "Inventory Read", "Read inventory items, inventory levels, locations, and fulfillment-order state.", true),
  capability("commerce_draft", "Commerce Draft", "Prepare exact Shopify product, order, refund, return, fulfillment, inventory, or webhook change plans without side effects.", true),
  capability("catalog_write", "Catalog Write", "Create or update products, variants, collections, product status, pricing, or publication only after approval.", false),
  capability("orders_refunds_manage", "Orders Refunds Manage", "Create refunds, returns, restocks, fulfillment updates, or order-state changes only after approval.", false),
  capability("inventory_fulfillment_manage", "Inventory Fulfillment Manage", "Adjust inventory or fulfillment state only after approval with exact location, item, quantity, and order context.", false),
  capability("webhooks_manage", "Webhooks Manage", "Create, update, or delete webhook subscriptions only after approval.", false),
];
