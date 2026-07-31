# Shopify Workflow Router

Use Shopify when a request concerns Shop, Product, ProductVariant, Collection, Order, Customer, InventoryItem, InventoryLevel, FulfillmentOrder, Fulfillment, Refund, Return, WebhookSubscription, provider webhooks, or billing/commerce state in a Shopify shop Admin API connection.

Do not use Shopify for unrelated CRM notes, local-only warehouse tasks, secret extraction, raw card access, legal/tax/business settings, or unapproved live money movement.

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

## Routing Steps

1. Identify whether the task is read, draft, approval-required write, or blocked.
2. Resolve object identifiers with read endpoints before drafting mutations or POST/PATCH/DELETE calls.
3. For approval-required work, prepare the exact endpoint, object id, amount/currency when applicable, customer impact, environment, and rollback/monitoring notes.
4. Execute only after approval and summarize response status without exposing secrets or excessive customer data.

## Provider Risks

- Production catalogue changes alter storefront buying options.
- Refunds, returns, fulfillment, and restock choices affect money movement, inventory, customer notifications, and accounting.
- Customer/order exports carry protected customer data risk.
