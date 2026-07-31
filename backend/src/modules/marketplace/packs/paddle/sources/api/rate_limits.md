# Paddle Rate Limits And Throttling

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.paddle.com/api-reference/overview
- https://developer.paddle.com/api-reference/about/authentication
- https://developer.paddle.com/api-reference/about/rate-limiting
- https://developer.paddle.com/api-reference/about/errors
- https://developer.paddle.com/api-reference/customers/overview
- https://developer.paddle.com/api-reference/products/overview
- https://developer.paddle.com/api-reference/prices/overview
- https://developer.paddle.com/api-reference/transactions/overview
- https://developer.paddle.com/api-reference/subscriptions/overview
- https://developer.paddle.com/api-reference/adjustments/overview
- https://developer.paddle.com/webhooks/overview

## Pack Doctrine

- Operate only against a Paddle sandbox or live account API connection.
- Verify environment, provider object IDs, selected capabilities, and approval profile before writes.
- Prefer read and draft workflows until a concrete approval exists for side effects.
- Redact secrets, full tokens, webhook secrets, raw payment data, and unnecessary customer billing details.
- Record provider ids, request purpose, approval id, and safe response summaries after approved writes.

- Most Paddle API operations are limited to 240 requests per minute per IP address.
- Preview transaction and preview prices operations support up to 1,000 requests per minute.
- Subscription updates that create immediate charges are limited per subscription: 20 chargeable updates per hour and 100 per 24 hours.
- On 429, honor `Retry-After`; do not loop subscription chargeable updates.

## Throttle Doctrine

- Use bounded pages and provider includes/field selection where available.
- Prefer webhooks/events over polling.
- Back off on 429 and avoid repeated high-risk writes during ambiguous provider state.
