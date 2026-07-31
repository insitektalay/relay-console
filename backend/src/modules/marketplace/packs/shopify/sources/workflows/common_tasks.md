# Shopify Common Tasks

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

## Common Read Tasks

- Summarize products with status DRAFT or ACTIVE and variants with inventory below 5 for shop `acme.myshopify.com`.
- Read order `gid://shopify/Order/450789469` with fulfillments, refunds, returns, and customer contact fields redacted.
- Check the GraphQL cost for this products query and suggest a smaller page size if it would throttle.

## Common Draft Tasks

- Draft only: Create or update products, variants, collections, product status, prices, or published catalogue state.
- Draft only: Adjust inventory levels, move inventory between locations, create fulfillments, cancel fulfillments, or change order state.
- Draft only: Create refunds or returns, restock refunded line items, notify customers, or expose customer-facing order outcomes.
- Draft only: Create/update/delete webhook subscriptions or export customer/order data.
