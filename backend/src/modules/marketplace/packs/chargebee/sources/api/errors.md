# Chargebee Errors And Failure Modes

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

- 401 means authentication failed; verify site subdomain, key, and Basic Auth username.
- 429 indicates rate/concurrency limit breach; back off for roughly the reset window.
- Validation failures include field constraints such as immutable item IDs, max lengths, incompatible item price changes, missing currency for multicurrency, and subscription state conflicts.
- Hosted pages have states such as created, requested, succeeded, cancelled, and acknowledged; retrieve the page before acting on checkout results.

## Failure Handling

- Do not retry writes blindly.
- For money, inventory, fulfillment, entitlement, or catalogue writes, read current object state before retrying.
- Capture provider request IDs or error codes in summaries when available, without including secrets.
