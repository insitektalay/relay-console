# Paddle Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.paddle.com/api-reference/overview
- https://developer.paddle.com/api-reference/about/authentication
- https://developer.paddle.com/api-reference/about/rate-limiting
- https://developer.paddle.com/api-reference/about/errors
- https://developer.paddle.com/api-reference/customers/overview
- https://developer.paddle.com/api-reference/products/overview
- https://developer.paddle.com/api-reference/prices/overview
- https://developer.paddle.com/api-reference/transactions/overview
- https://developer.paddle.com/api-reference/subscriptions/overview
- https://developer.paddle.com/api-reference/adjustments/overview
- https://developer.paddle.com/webhooks/overview

## Pack Doctrine

- Operate only against a Paddle sandbox or live account API connection.
- Verify environment, provider object IDs, selected capabilities, and approval profile before writes.
- Prefer read and draft workflows until a concrete approval exists for side effects.
- Redact secrets, full tokens, webhook secrets, raw payment data, and unnecessary customer billing details.
- Record provider ids, request purpose, approval id, and safe response summaries after approved writes.

## Authentication Model

- Use Bearer authentication with a Paddle API key in the `Authorization` header.
- API keys are server-side only, environment-specific, and can be created for sandbox or live mode.
- Keys have permissions assigned in Paddle Developer tools; missing permissions return 403 `forbidden`.
- Client-side tokens are only for Paddle.js checkout/preview workflows and must not be used as backend API keys.

## Secret Safety

- Store credentials only in ClawChat marketplace connections.
- Never render API keys, Admin access tokens, webhook signing secrets, Basic Auth headers, or bearer tokens into generated docs, chat, logs, examples, or approval summaries.
- If authentication fails, debug provider environment, scopes/permissions, key revocation, token installation, site/shop/account mismatch, and provider status before asking for broader permissions.
