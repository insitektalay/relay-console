# Shopify Write Workflows

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

## Approval-Required Writes

- Create or update products, variants, collections, product status, prices, or published catalogue state.
- Adjust inventory levels, move inventory between locations, create fulfillments, cancel fulfillments, or change order state.
- Create refunds or returns, restock refunded line items, notify customers, or expose customer-facing order outcomes.
- Create/update/delete webhook subscriptions or export customer/order data.

## Execution Checklist

1. Read the current provider object.
2. Prepare the exact request payload and expected customer/business effect.
3. Confirm approval id and environment.
4. Execute once; then re-read state and summarize safe response fields.
