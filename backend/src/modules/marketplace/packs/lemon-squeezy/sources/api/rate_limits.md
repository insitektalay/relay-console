# Lemon Squeezy Rate Limits And Throttling

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

- JSON:API endpoints are limited to 300 API calls per minute.
- Successful responses include `X-Ratelimit-Limit` and `X-Ratelimit-Remaining` headers.
- Exceeding the limit returns 429 Too Many Requests.
- License API calls are rate limited to 60 requests per minute.

## Throttle Doctrine

- Use bounded pages and provider includes/field selection where available.
- Prefer webhooks/events over polling.
- Back off on 429 and avoid repeated high-risk writes during ambiguous provider state.
