# Chargebee Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://apidocs.chargebee.com/docs/api
- https://apidocs.chargebee.com/docs/api/auth
- https://apidocs.chargebee.com/docs/api/customers/customer-object
- https://apidocs.chargebee.com/docs/api/items
- https://apidocs.chargebee.com/docs/api/item_prices/item-price-object
- https://apidocs.chargebee.com/docs/api/subscriptions
- https://apidocs.chargebee.com/docs/api/invoices
- https://apidocs.chargebee.com/docs/api/estimates/create-invoice-for-items-estimate
- https://apidocs.chargebee.com/docs/api/hosted_pages
- https://apidocs.chargebee.com/docs/api/webhooks
- https://www.chargebee.com/docs/billing/2.0/kb/platform/what-are-the-chargebee-api-limits

## Pack Doctrine

- Operate only against a Chargebee test or live site API connection.
- Verify environment, provider object IDs, selected capabilities, and approval profile before writes.
- Prefer read and draft workflows until a concrete approval exists for side effects.
- Redact secrets, full tokens, webhook secrets, raw payment data, and unnecessary customer billing details.
- Record provider ids, request purpose, approval id, and safe response summaries after approved writes.

- GET/POST /customers and /customers/{id}
- GET/POST /subscriptions, /subscriptions/{id}, subscription create/update/cancel/pause/resume/reactivate endpoints
- GET/POST /items and /item_prices for plans, addons, charges, and prices
- GET/POST /invoices including create invoice, collect payment, void/write-off where available
- GET /transactions and payment-related invoice context
- GET/POST /estimates including create_invoice_for_items estimate before invoice creation
- GET/POST /coupons and coupon application flows
- POST /hosted_pages/checkout_new, checkout_existing, update_payment_method, collect_now and GET /hosted_pages/{id}
- GET /events and webhook configuration/delivery APIs

## Read Method Doctrine

- Use list/retrieve/search queries with bounded pagination and explicit includes/fields.
- Resolve canonical provider IDs before proposing writes.
- Minimize customer, order, invoice, license, and billing data in summaries.

## Write Method Doctrine

- Create/send/collect invoices or create hosted checkout/payment pages.
- Refund payments, issue credit notes, write off/void invoices, or apply credits.
- Create/update/cancel/pause/resume/reactivate subscriptions or change item prices/plans/coupons.
- Create/update webhook settings, export customer billing data, or change entitlement-affecting subscription items.
