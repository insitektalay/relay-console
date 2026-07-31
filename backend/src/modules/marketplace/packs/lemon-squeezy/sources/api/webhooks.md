# Lemon Squeezy Webhooks And Events

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

## Event Families

- order_created
- order_refunded
- customer_updated
- subscription_created
- subscription_updated
- subscription_cancelled
- subscription_resumed
- subscription_expired
- subscription_paused
- subscription_unpaused
- subscription_payment_failed
- subscription_payment_success
- license_key_created
- license_key_updated

## Webhook Doctrine

- Read webhook/event configuration and delivery status when capability allows.
- Creating, updating, deleting, disabling, or broadening webhook subscriptions requires approval.
- Never reveal webhook signing secrets; validate signatures in runtime integrations before trusting payloads.
