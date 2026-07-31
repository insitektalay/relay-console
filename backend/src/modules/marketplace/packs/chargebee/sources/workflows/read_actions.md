# Chargebee Read Workflows

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

- Read customers, subscriptions, items/plans/item prices, invoices, payments/transactions, estimates, coupons, hosted pages, events, and webhook configuration.
- Summarize billing lifecycle, invoice/payment/refund state, hosted-page state, customer billing data, and test/live site context.
- Prepare proposed subscription, invoice, estimate, coupon, hosted-page, item price, refund/credit, or webhook changes without side effects.

## Read Guardrails

- Bound result sets and specify object ids, status filters, date ranges, or provider search filters.
- Redact private customer billing fields unless the user explicitly needs them for the task.
- Read rate-limit/throttle metadata when available before expanding pagination.
