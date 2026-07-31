# Paddle Good Requests

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

- List active subscriptions for customer `ctm_01hv976dcgq4wmyrp8yq7asfmj` and summarize renewal date, items, and next transaction status.
- Retrieve transaction `txn_01hv975mbh902hcyb7mks5kt0n` with invoice metadata and redact customer email in the summary.
- Compare sandbox and live API key environment labels before preparing a refund plan.
