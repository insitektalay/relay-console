# Dropbox Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.dropbox.com/developers/documentation/http/overview
- https://www.dropbox.com/developers/reference/oauth-guide
- https://developers.dropbox.com/oauth-guide#scopes
- https://www.dropbox.com/developers/documentation/http/documentation
- https://www.dropbox.com/developers/reference/webhooks

## Authentication Model

OAuth 2.0 access and refresh tokens. Store access/refresh tokens only in ClawChat. Shared-drive/team-space access depends on token user, app scopes, and resource membership.

## Secret Safety

- Store provider tokens, API keys, client secrets, refresh tokens, webhook secrets, signing secrets, private keys, and database/payment secrets only in ClawChat connections.
- Never display, summarize, forward, log, or write secret values into generated docs, comments, tickets, messages, files, or tool output.
- If authentication fails, stop and ask the user to repair the connection. Do not request secret values in chat.
