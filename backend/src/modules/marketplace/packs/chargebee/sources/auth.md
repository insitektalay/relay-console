# Chargebee Authentication

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

## Authentication Model

- Chargebee uses HTTP Basic authentication with the API key as username and an empty password.
- The base URL is `{site}.chargebee.com/api/v2`; API keys are different for test and live sites.
- Requests are HTTPS, generally form-encoded for POST writes, and return JSON.
- API keys are managed under Settings > Configure Chargebee > API Keys and Webhooks and must never be exposed.

## Secret Safety

- Store credentials only in ClawChat marketplace connections.
- Never render API keys, Admin access tokens, webhook signing secrets, Basic Auth headers, or bearer tokens into generated docs, chat, logs, examples, or approval summaries.
- If authentication fails, debug provider environment, scopes/permissions, key revocation, token installation, site/shop/account mismatch, and provider status before asking for broader permissions.
