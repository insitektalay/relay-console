# ClickUp Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.clickup.com/docs
- https://developer.clickup.com/docs/authentication
- https://developer.clickup.com/reference
- https://developer.clickup.com/docs/webhooks
- https://developer.clickup.com/docs/rate-limits

## Authentication Model

OAuth or personal API token. Tokens stay in ClawChat and inherit workspace/project access.

## Secret Safety

- Store provider tokens, API keys, client secrets, refresh tokens, webhook secrets, signing secrets, private keys, and database/payment secrets only in ClawChat connections.
- Never display, summarize, forward, log, or write secret values into generated docs, comments, tickets, messages, files, or tool output.
- If authentication fails, stop and ask the user to repair the connection. Do not request secret values in chat.
