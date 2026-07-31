# Shopify Approval-Required Examples

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

- Create the approved partial refund for order `gid://shopify/Order/450789469`, line item quantity 1, no shipping refund, restock to location `gid://shopify/Location/123`.
- Update variant `gid://shopify/ProductVariant/789` price to USD 49.00 and publish the product after approval `APR-123`.
- Adjust inventory item `gid://shopify/InventoryItem/456` by -3 at location `gid://shopify/Location/123` because warehouse count was reconciled.
