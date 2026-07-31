# Stripe Core Objects

## Customers

Official source: https://docs.stripe.com/api/customers

Customers represent people or businesses paying through Stripe. Use them to inspect billing identity, payment status, subscriptions, invoice history, and metadata. Customer deletion is blocked.

## Invoices

Official source: https://docs.stripe.com/api/invoices

Invoices represent amounts owed by a customer. Draft invoice creation can be safe when `invoices_draft` is enabled. Finalizing, sending, paying, voiding, or marking uncollectible requires approval.

## Subscriptions

Official source: https://docs.stripe.com/api/subscriptions

Subscriptions charge customers on a recurring basis. Reads are safe when enabled. Creation, update, cancellation, pause, resume, and migration require approval.

## Payment Links

Official source: https://docs.stripe.com/api/payment-link

Payment links are shareable hosted payment URLs. Creating or updating them can expose a live checkout surface and requires approval.

## Refunds

Official source: https://docs.stripe.com/api/refunds

Refunds move money back to a customer. Creating or canceling refunds requires approval and verified payment context.

## Products And Prices

Official sources:

- https://docs.stripe.com/api/products
- https://docs.stripe.com/api/prices

Products describe goods or services. Prices define unit cost, currency, and recurring terms. Changes affect checkout and billing and require approval.

## Webhook Endpoints

Official source: https://docs.stripe.com/api/webhook_endpoints

Webhook endpoints receive Stripe events. Reading endpoint configuration can be safe when enabled. Creating, updating, disabling, or deleting endpoints requires approval.
