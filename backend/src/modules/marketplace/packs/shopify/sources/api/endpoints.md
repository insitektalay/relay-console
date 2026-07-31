# Shopify Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://shopify.dev/docs/api/admin-graphql
- https://shopify.dev/docs/api/admin-rest
- https://shopify.dev/docs/admin-api/access-scopes
- https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin
- https://shopify.dev/docs/api/usage/limits
- https://shopify.dev/docs/apps/build/webhooks
- https://shopify.dev/docs/api/admin-graphql#status-and-error-codes
- https://shopify.dev/docs/api/admin-rest/latest/resources/refund

## Pack Doctrine

- Operate only against a Shopify shop Admin API connection.
- Verify environment, provider object IDs, selected capabilities, and approval profile before writes.
- Prefer read and draft workflows until a concrete approval exists for side effects.
- Redact secrets, full tokens, webhook secrets, raw payment data, and unnecessary customer billing details.
- Record provider ids, request purpose, approval id, and safe response summaries after approved writes.

- POST /admin/api/2026-01/graphql.json query `shop`, `products`, `productVariants`, `orders`, `customers`, `inventoryItems`, `inventoryLevels`
- POST /admin/api/2026-01/graphql.json mutation `productCreate`, `productUpdate`, `productVariantsBulkUpdate`, `collectionCreate`
- POST /admin/api/2026-01/graphql.json mutation `inventoryAdjustQuantities` or inventory-level mutations for exact location/item changes
- POST /admin/api/2026-01/graphql.json fulfillment-order and fulfillment mutations for assigned merchant/third-party fulfillment orders
- POST /admin/api/2026-01/graphql.json `refundCreate`, return queries/mutations where scopes allow
- POST /admin/api/2026-01/graphql.json `webhookSubscriptionCreate`, `webhookSubscriptionUpdate`, `webhookSubscriptionDelete`
- REST examples where legacy support is needed: GET /admin/api/2026-01/products.json, GET /orders/{order_id}/refunds.json, POST /orders/{order_id}/refunds/calculate.json

## Read Method Doctrine

- Use list/retrieve/search queries with bounded pagination and explicit includes/fields.
- Resolve canonical provider IDs before proposing writes.
- Minimize customer, order, invoice, license, and billing data in summaries.

## Write Method Doctrine

- Create or update products, variants, collections, product status, prices, or published catalogue state.
- Adjust inventory levels, move inventory between locations, create fulfillments, cancel fulfillments, or change order state.
- Create refunds or returns, restock refunded line items, notify customers, or expose customer-facing order outcomes.
- Create/update/delete webhook subscriptions or export customer/order data.
