# Lemon Squeezy Read Workflows

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

- Read stores, products, variants, prices, files, orders, customers, subscriptions, subscription invoices, license keys, discounts, checkouts, and webhooks.
- Summarize commerce, subscription, license, file/download, and customer/order state with private data minimized.
- Prepare proposed checkout, discount, subscription, refund, license, file, or webhook changes without side effects.

## Read Guardrails

- Bound result sets and specify object ids, status filters, date ranges, or provider search filters.
- Redact private customer billing fields unless the user explicitly needs them for the task.
- Read rate-limit/throttle metadata when available before expanding pagination.
