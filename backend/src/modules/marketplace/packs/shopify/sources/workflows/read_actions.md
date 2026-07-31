# Shopify Read Workflows

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

- Read shops, products, variants, collections, orders, customers, inventory items/levels, fulfillments, returns, refunds, and webhook configuration.
- Summarize catalogue health, order state, inventory risk, fulfillment status, and customer/order history using bounded queries.
- Prepare proposed product, inventory, fulfillment, refund, return, and webhook changes without calling mutations.

## Read Guardrails

- Bound result sets and specify object ids, status filters, date ranges, or provider search filters.
- Redact private customer billing fields unless the user explicitly needs them for the task.
- Read rate-limit/throttle metadata when available before expanding pagination.
