# Google Drive Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/drive/api/guides/about-sdk
- https://developers.google.com/drive/api/guides/about-auth
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/reference/rest/v3
- https://developers.google.com/drive/api/guides/push
- https://developers.google.com/drive/api/guides/handle-errors

## Authentication Model

Google OAuth 2.0. Store access/refresh tokens only in ClawChat. Shared-drive/team-space access depends on token user, app scopes, and resource membership.

## Secret Safety

- Store provider tokens, API keys, client secrets, refresh tokens, webhook secrets, signing secrets, private keys, and database/payment secrets only in ClawChat connections.
- Never display, summarize, forward, log, or write secret values into generated docs, comments, tickets, messages, files, or tool output.
- If authentication fails, stop and ask the user to repair the connection. Do not request secret values in chat.
