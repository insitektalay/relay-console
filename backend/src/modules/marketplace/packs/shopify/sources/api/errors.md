# Shopify Errors And Failure Modes

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

- GraphQL can return HTTP 200 with `errors` or mutation `userErrors`; never treat HTTP 200 alone as success.
- Scope failures surface as access denied or missing field errors; verify granted scopes with the app installation before retrying.
- Protected customer data and older order windows may require approved scopes such as `read_all_orders`.
- Inventory and fulfillment writes fail when IDs, locations, fulfillment assignment, or restock semantics are wrong.

## Failure Handling

- Do not retry writes blindly.
- For money, inventory, fulfillment, entitlement, or catalogue writes, read current object state before retrying.
- Capture provider request IDs or error codes in summaries when available, without including secrets.
