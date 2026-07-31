# Shopify Rate Limits And Throttling

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

- Admin GraphQL uses a calculated query-cost model. Complex selections cost more; single queries can be rejected when requested cost exceeds the maximum.
- GraphQL responses include throttle status under `extensions.cost`; read `currentlyAvailable`, `restoreRate`, and requested/actual cost before retrying.
- REST Admin API uses a leaky bucket of 40 requests per app/store/minute, replenished at 2 requests/second, with higher limits for Shopify Plus; honor `X-Shopify-Shop-Api-Call-Limit` and `Retry-After` on 429.

## Throttle Doctrine

- Use bounded pages and provider includes/field selection where available.
- Prefer webhooks/events over polling.
- Back off on 429 and avoid repeated high-risk writes during ambiguous provider state.
