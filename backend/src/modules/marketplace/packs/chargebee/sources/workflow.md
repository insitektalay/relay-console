# Chargebee Workflow Router

Use Chargebee when a request concerns Customer, Subscription, Item, Plan item, Addon item, Charge item, Item price, Invoice, Payment, Transaction, Credit note, Estimate, Coupon, Hosted page, Event, Webhook, provider webhooks, or billing/commerce state in a Chargebee test or live site API connection.

Do not use Chargebee for unrelated CRM notes, local-only warehouse tasks, secret extraction, raw card access, legal/tax/business settings, or unapproved live money movement.

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

## Routing Steps

1. Identify whether the task is read, draft, approval-required write, or blocked.
2. Resolve object identifiers with read endpoints before drafting mutations or POST/PATCH/DELETE calls.
3. For approval-required work, prepare the exact endpoint, object id, amount/currency when applicable, customer impact, environment, and rollback/monitoring notes.
4. Execute only after approval and summarize response status without exposing secrets or excessive customer data.

## Provider Risks

- Subscription lifecycle changes alter revenue recognition and customer entitlement.
- Invoices, payments, refunds, credit notes, and hosted pages can move money or trigger customer-facing payment flows.
- Customer billing data is sensitive and must be minimized in exports.
