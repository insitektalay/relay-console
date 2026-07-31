# Shopify Webhooks And Events

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

## Event Families

- orders/create
- orders/updated
- orders/paid
- refunds/create
- customers/create
- customers/update
- products/create
- products/update
- inventory_levels/update
- fulfillments/create
- returns/create
- app/uninstalled

## Webhook Doctrine

- Read webhook/event configuration and delivery status when capability allows.
- Creating, updating, deleting, disabling, or broadening webhook subscriptions requires approval.
- Never reveal webhook signing secrets; validate signatures in runtime integrations before trusting payloads.
