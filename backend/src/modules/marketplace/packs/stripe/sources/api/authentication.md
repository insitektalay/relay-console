# Stripe API Authentication

Official source: https://docs.stripe.com/api/authentication

Stripe uses API keys to authenticate API requests. Requests must use HTTPS. API requests without authentication fail.

## Agent Rules

- Never ask for or display API keys in chat.
- Never embed a key in generated examples.
- Use the marketplace connection only.
- Prefer restricted API keys with resource-level permissions.
- Treat live keys as high risk.
- Treat webhook signing secrets as separate secrets.

## Key Types

- Sandbox/test secret keys identify test mode server-side access.
- Live secret keys identify live mode server-side access.
- Restricted keys can limit access to specific resources.
- Webhook signing secrets verify webhook payloads and are not API keys.

## Connect/OAuth

For OAuth-backed connections, operate only within the OAuth access token and account context stored in the marketplace connection. If the target connected account is ambiguous, stop and ask the user to identify it.
