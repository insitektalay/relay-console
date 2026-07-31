# Lemon Squeezy Good Requests

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

- List subscriptions for customer ID `1` and summarize status, renews_at, ends_at, product_id, variant_id, and update_payment_method URL presence.
- Retrieve order `104e18a2-d755-4d4b-80c4-a6c1dcbe1c10` and summarize currency, total, product, variant, and license key short values.
- Check products and variants that have files attached and identify disabled variants.
