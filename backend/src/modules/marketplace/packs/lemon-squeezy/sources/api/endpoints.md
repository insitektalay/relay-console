# Lemon Squeezy Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.lemonsqueezy.com/api
- https://docs.lemonsqueezy.com/guides/developer-guide/getting-started
- https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
- https://docs.lemonsqueezy.com/guides/developer-guide/managing-subscriptions
- https://docs.lemonsqueezy.com/guides/developer-guide/webhooks
- https://docs.lemonsqueezy.com/help/webhooks
- https://docs.lemonsqueezy.com/api/license-api
- https://docs.lemonsqueezy.com/api/license-keys/the-license-key-object
- https://docs.lemonsqueezy.com/api/variants/the-variant-object

## Pack Doctrine

- Operate only against a Lemon Squeezy store API connection.
- Verify environment, provider object IDs, selected capabilities, and approval profile before writes.
- Prefer read and draft workflows until a concrete approval exists for side effects.
- Redact secrets, full tokens, webhook secrets, raw payment data, and unnecessary customer billing details.
- Record provider ids, request purpose, approval id, and safe response summaries after approved writes.

- GET /v1/stores, /v1/products, /v1/variants, /v1/prices, /v1/files
- GET /v1/orders, /v1/orders/{id}, POST /v1/orders/{id}/generate-invoice, POST /v1/orders/{id}/refund
- GET/POST/PATCH /v1/customers and /v1/customers/{id}
- GET/PATCH/DELETE /v1/subscriptions/{id}; subscription invoice refund/generation endpoints
- GET/PATCH /v1/license-keys/{id}, GET /v1/license-key-instances, License API activate/validate/deactivate
- GET/POST /v1/discounts and DELETE /v1/discounts/{id}
- POST /v1/checkouts and GET /v1/checkouts/{id}
- GET/POST/PATCH/DELETE /v1/webhooks

## Read Method Doctrine

- Use list/retrieve/search queries with bounded pagination and explicit includes/fields.
- Resolve canonical provider IDs before proposing writes.
- Minimize customer, order, invoice, license, and billing data in summaries.

## Write Method Doctrine

- Create checkout links or custom-priced checkout sessions.
- Refund orders or subscription invoices.
- Update/cancel/resume/pause subscriptions or record usage.
- Create/delete discounts, update variants/files/download availability, modify license keys or license activations, or create/update/delete webhooks.
