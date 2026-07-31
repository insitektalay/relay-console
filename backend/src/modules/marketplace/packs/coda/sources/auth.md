# Coda Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://coda.io/developers/apis/v1
- https://coda.io/developers/apis/v1#section/Authentication
- https://coda.io/developers/apis/v1#operation/listDocs
- https://coda.io/developers/apis/v1#section/Rate-limits
- https://coda.io/developers/apis/v1#section/Errors
- https://coda.io/developers/apis/v1#tag/Webhooks

## Authentication Model

Bearer API tokens. Tokens remain in ClawChat connections and are constrained by workspace/base/doc sharing and provider permissions.

## Secret Safety

- Store provider tokens, API keys, client secrets, refresh tokens, webhook secrets, signing secrets, private keys, and database/payment secrets only in ClawChat connections.
- Never display, summarize, forward, log, or write secret values into generated docs, comments, tickets, messages, files, or tool output.
- If authentication fails, stop and ask the user to repair the connection. Do not request secret values in chat.
