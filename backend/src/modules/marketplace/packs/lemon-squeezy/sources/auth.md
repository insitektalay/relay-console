# Lemon Squeezy Authentication

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

## Authentication Model

- Use Bearer authentication with `Authorization: Bearer {api_key}`.
- API requests use `Accept: application/vnd.api+json` and `Content-Type: application/vnd.api+json` for JSON:API endpoints.
- The License API is separate: HTTPS to `api.lemonsqueezy.com`, `Accept: application/json`, and form-encoded POST requests for activate/validate/deactivate.
- API keys and webhook signing secrets stay only in ClawChat connection storage.

## Secret Safety

- Store credentials only in ClawChat marketplace connections.
- Never render API keys, Admin access tokens, webhook signing secrets, Basic Auth headers, or bearer tokens into generated docs, chat, logs, examples, or approval summaries.
- If authentication fails, debug provider environment, scopes/permissions, key revocation, token installation, site/shop/account mismatch, and provider status before asking for broader permissions.
