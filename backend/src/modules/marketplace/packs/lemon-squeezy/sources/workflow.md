# Lemon Squeezy Workflow Router

Use Lemon Squeezy when a request concerns Store, Product, Variant, Price, File, Order, Order item, Subscription, Subscription invoice, Subscription item, Usage record, Customer, License key, License key instance, Discount, Discount redemption, Checkout, Webhook, provider webhooks, or billing/commerce state in a Lemon Squeezy store API connection.

Do not use Lemon Squeezy for unrelated CRM notes, local-only warehouse tasks, secret extraction, raw card access, legal/tax/business settings, or unapproved live money movement.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.lemonsqueezy.com/api
- https://docs.lemonsqueezy.com/guides/developer-guide/getting-started
- https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
- https://docs.lemonsqueezy.com/guides/developer-guide/managing-subscriptions
- https://docs.lemonsqueezy.com/guides/developer-guide/webhooks
- https://docs.lemonsqueezy.com/help/webhooks
- https://docs.lemonsqueezy.com/api/license-api
- https://docs.lemonsqueezy.com/api/license-keys/the-license-key-object
- https://docs.lemonsqueezy.com/api/variants/the-variant-object

## Pack Doctrine

- Operate only against a Lemon Squeezy store API connection.
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

- Checkout and discount changes affect live revenue.
- Subscription plan changes may invoice immediately, disable proration, or change entitlement access.
- License revocation/activation changes can lock customers out of purchased software.
