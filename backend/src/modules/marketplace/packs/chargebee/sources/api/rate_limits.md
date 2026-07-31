# Chargebee Rate Limits And Throttling

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

- Default live-site limits vary by plan: Starter 150 requests/minute, Performance 1000 requests/minute, Enterprise default 3500 requests/minute, with custom Enterprise arrangements possible.
- Test sites default to 150 requests per minute.
- Chargebee also considers concurrent requests; exceeding request-per-minute or concurrency limits returns HTTP 429.
- For live sites, sustained overage can flag the account and block GET/POST requests until throttled.

## Throttle Doctrine

- Use bounded pages and provider includes/field selection where available.
- Prefer webhooks/events over polling.
- Back off on 429 and avoid repeated high-risk writes during ambiguous provider state.
