# Paddle Endpoint Families

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

- GET/POST/PATCH /customers and /customers/{customer_id}
- GET/POST/PATCH /products and /products/{product_id}
- GET/POST/PATCH /prices and /prices/{price_id}
- GET/POST/PATCH /transactions, /transactions/{transaction_id}, /transactions/{transaction_id}/invoice, preview transaction operations
- GET/PATCH /subscriptions, /subscriptions/{subscription_id}, subscription pause/resume/cancel/update-payment-method operations
- GET/POST /adjustments for refunds and credits, including adjustment credit-note retrieval
- GET /event-types, notification settings/webhook destination APIs where available

## Read Method Doctrine

- Use list/retrieve/search queries with bounded pagination and explicit includes/fields.
- Resolve canonical provider IDs before proposing writes.
- Minimize customer, order, invoice, license, and billing data in summaries.

## Write Method Doctrine

- Create transactions, invoices, or checkout/payment links that can collect money.
- Create refunds, credits, or adjustments against billed/completed transactions.
- Update, pause, resume, or cancel subscriptions, especially immediate-proration changes.
- Create/update products, prices, discounts, or notification/webhook settings.
