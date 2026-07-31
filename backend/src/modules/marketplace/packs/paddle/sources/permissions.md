# Paddle Permissions

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

## Allowed

- Read customers, products, prices, transactions, subscriptions, invoices, adjustments, discounts, and webhook/event configuration.
- Summarize billing state, renewal dates, invoice/receipt status, transaction totals, and sandbox/live environment.
- Prepare proposed subscription, price, transaction, adjustment, or webhook changes without side effects.

## Approval Required

- Create transactions, invoices, or checkout/payment links that can collect money.
- Create refunds, credits, or adjustments against billed/completed transactions.
- Update, pause, resume, or cancel subscriptions, especially immediate-proration changes.
- Create/update products, prices, discounts, or notification/webhook settings.

## Blocked

- Expose Paddle API keys or webhook secrets.
- Access raw payment/card data.
- Disable fraud/security settings, broaden API key permissions, change tax/legal/business settings, delete financial records, or perform live money movement without approval.
