# Stripe Errors

Official sources:

- https://docs.stripe.com/error-handling
- https://docs.stripe.com/api/errors

## Agent Rules

- Authentication errors mean the marketplace connection needs attention. Do not ask for secrets in chat.
- Permission errors mean the key, restricted key, OAuth scope, account, or selected capability is insufficient.
- Validation errors must be reported with the invalid field and a safe correction plan.
- Rate-limit and lock-timeout errors should use conservative retry and backoff when the runtime tool supports it.
- For creates and updates, use idempotency when the runtime tool supports it.
- Never retry money movement blindly.

## Approval-Sensitive Errors

If a write partially succeeds, stop and report the provider response. Do not try compensating actions such as refunds, invoice voids, subscription cancellation, or webhook deletion without a new approval.

## Escalation Data

Report safe fields only:

- Operation.
- Environment.
- Object type and ID.
- HTTP status or provider error type.
- Human-readable message.
- Whether the action was read, draft, approval-required, or blocked.

Do not report secrets, request authentication headers, webhook signatures, raw card data, or full payloads containing sensitive payment data.
