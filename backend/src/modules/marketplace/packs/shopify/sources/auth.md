# Shopify Authentication

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

## Authentication Model

- Admin GraphQL requests use `X-Shopify-Access-Token` against `{shop}.myshopify.com/admin/api/{version}/graphql.json`.
- Public and custom apps created in the Dev Dashboard acquire Admin access tokens through OAuth; admin-created custom apps are installed in Shopify Admin to generate the Admin API token.
- The app must request minimum Admin access scopes such as `read_products`, `write_products`, `read_orders`, `write_orders`, `read_customers`, `read_inventory`, fulfillment-order scopes, `read_returns`, or `write_returns` only when needed.
- REST Admin API is legacy for new public apps but remains relevant for older resources and migration; prefer Admin GraphQL for new work.

## Secret Safety

- Store credentials only in ClawChat marketplace connections.
- Never render API keys, Admin access tokens, webhook signing secrets, Basic Auth headers, or bearer tokens into generated docs, chat, logs, examples, or approval summaries.
- If authentication fails, debug provider environment, scopes/permissions, key revocation, token installation, site/shop/account mismatch, and provider status before asking for broader permissions.
