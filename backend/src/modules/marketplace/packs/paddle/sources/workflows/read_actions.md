# Paddle Read Workflows

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

- Read customers, products, prices, transactions, subscriptions, invoices, adjustments, discounts, and webhook/event configuration.
- Summarize billing state, renewal dates, invoice/receipt status, transaction totals, and sandbox/live environment.
- Prepare proposed subscription, price, transaction, adjustment, or webhook changes without side effects.

## Read Guardrails

- Bound result sets and specify object ids, status filters, date ranges, or provider search filters.
- Redact private customer billing fields unless the user explicitly needs them for the task.
- Read rate-limit/throttle metadata when available before expanding pagination.
