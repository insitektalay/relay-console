# Lemon Squeezy Errors And Failure Modes

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

- JSON:API uses standard HTTP response codes; invalid payloads return 4xx responses.
- License API returns 400, 404, or 422 with an `error` field.
- Webhook signatures must be validated with the configured signing secret; failed validation means do not trust the payload.

## Failure Handling

- Do not retry writes blindly.
- For money, inventory, fulfillment, entitlement, or catalogue writes, read current object state before retrying.
- Capture provider request IDs or error codes in summaries when available, without including secrets.
