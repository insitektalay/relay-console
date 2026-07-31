# Stripe Authentication

Stripe authenticates API requests with API keys. Secret keys and restricted keys are server-side credentials. Stripe also supports OAuth for Connect-style integrations.

Official sources:

- https://docs.stripe.com/api/authentication
- https://docs.stripe.com/keys
- https://docs.stripe.com/keys-best-practices
- https://docs.stripe.com/connect/oauth-reference

{{CONNECTION_CONTEXT}}

## Credential Doctrine

- Store credentials only in the ClawChat marketplace connection.
- Prefer restricted API keys with the minimum resource permissions required for the selected capabilities.
- Use sandbox or test mode keys for testing and development.
- Use live mode keys only for approved live operations.
- Treat webhook signing secrets as separate from API keys.
- Never place Stripe credentials in markdown, source code, logs, generated runtime docs, chat messages, or approval summaries.

## Auth Types

- `api_key`: A Stripe secret or restricted key stored in the marketplace connection.
- `oauth`: A Connect OAuth access token stored in the marketplace connection.

## Required Credentials

- `STRIPE_SECRET_KEY` for `api_key` connections.
- `STRIPE_OAUTH_ACCESS_TOKEN` for `oauth` connections.
- `STRIPE_WEBHOOK_SECRET` only when webhook signature verification is configured.

## Insufficient Credentials

If Stripe returns authentication, expired key, deleted key, permission, or scope errors, stop and ask the user to update the marketplace connection. Do not ask the user to paste secrets into chat.
