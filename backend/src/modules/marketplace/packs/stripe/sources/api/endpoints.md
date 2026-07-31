# Stripe Endpoint Families

Use official Stripe docs for exact parameters, pagination, expansion, idempotency, and response shapes. The endpoint families below are the operational map for agents.

## Customers

- `GET /v1/customers`
- `GET /v1/customers/{customer}`
- `POST /v1/customers`
- `POST /v1/customers/{customer}`
- `GET /v1/customers/search`
- `DELETE /v1/customers/{customer}` is blocked by this pack.

## Invoices

- `GET /v1/invoices`
- `GET /v1/invoices/{invoice}`
- `POST /v1/invoices/create_preview`
- `POST /v1/invoices`
- `POST /v1/invoices/{invoice}`
- `DELETE /v1/invoices/{invoice}` only applies to draft invoices and is still approval-gated in this pack.
- `POST /v1/invoices/{invoice}/finalize`, `/send`, `/pay`, `/void`, and `/mark_uncollectible` require approval.

## Subscriptions

- `GET /v1/subscriptions`
- `GET /v1/subscriptions/{subscription}`
- `POST /v1/subscriptions`
- `POST /v1/subscriptions/{subscription}`
- `DELETE /v1/subscriptions/{subscription}`
- `POST /v1/subscriptions/{subscription}/resume`
- `POST /v1/subscriptions/{subscription}/migrate`

Subscription writes require approval.

## Payment Links

- `GET /v1/payment_links`
- `GET /v1/payment_links/{payment_link}`
- `GET /v1/payment_links/{payment_link}/line_items`
- `POST /v1/payment_links`
- `POST /v1/payment_links/{payment_link}`

Payment link creation and updates require approval.

## Refunds

- `GET /v1/refunds`
- `GET /v1/refunds/{refund}`
- `POST /v1/refunds`
- `POST /v1/refunds/{refund}/cancel`

Refund writes require approval.

## Products And Prices

- `GET /v1/products`
- `POST /v1/products`
- `POST /v1/products/{product}`
- `GET /v1/prices`
- `POST /v1/prices`
- `POST /v1/prices/{price}`

Product and price writes require approval.

## Disputes And Balance

- `GET /v1/disputes`
- `GET /v1/disputes/{dispute}`
- `GET /v1/balance`
- `GET /v1/balance_transactions`

Use for triage and reporting. Do not change payout, bank, or compliance settings.

## Webhook Endpoints

- `GET /v1/webhook_endpoints`
- `GET /v1/webhook_endpoints/{webhook_endpoint}`
- `POST /v1/webhook_endpoints`
- `POST /v1/webhook_endpoints/{webhook_endpoint}`
- `DELETE /v1/webhook_endpoints/{webhook_endpoint}`

Webhook endpoint writes require approval.
