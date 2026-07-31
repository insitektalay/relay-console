# Paddle API Overview

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

## Object Model

- Customer
- Address
- Business
- Product
- Price
- Transaction
- Subscription
- Invoice
- Adjustment
- Credit note
- Discount
- Notification setting
- Event

## Operating Notes

- Transactions, invoices, adjustments, and subscription updates can move money or change customer billing.
- Sandbox and live credentials look similar enough that environment must be verified before writes.
- Tax and merchant-of-record boundaries must not be altered by an agent.
