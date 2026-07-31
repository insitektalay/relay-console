# Outlook Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview
- https://learn.microsoft.com/en-us/graph/auth/
- https://learn.microsoft.com/en-us/graph/permissions-reference
- https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
- https://learn.microsoft.com/en-us/graph/change-notifications-overview
- https://learn.microsoft.com/en-us/graph/throttling
- https://learn.microsoft.com/en-us/graph/errors

## Authentication Model

Microsoft identity platform OAuth through Microsoft Graph. Access tokens and refresh tokens are stored only in ClawChat. Mailbox APIs require consented delegated or application permissions depending on provider and tenant policy.

## Secret Safety

- Store provider tokens, API keys, client secrets, refresh tokens, webhook secrets, signing secrets, private keys, and database/payment secrets only in ClawChat connections.
- Never display, summarize, forward, log, or write secret values into generated docs, comments, tickets, messages, files, or tool output.
- If authentication fails, stop and ask the user to repair the connection. Do not request secret values in chat.
