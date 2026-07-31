# Resend Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://resend.com/docs/api-reference/introduction
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/api-reference/rate-limit
- https://resend.com/docs/dashboard/webhooks/introduction
- https://resend.com/docs/api-reference/errors

## Authentication Model

Resend uses API keys passed as bearer tokens. Keys are created in the Resend dashboard and must be stored only in ClawChat connections. Domain verification and DNS records are account configuration, not chat-visible secrets.

Use the connector-held Resend API key only in the Authorization bearer header. API key values may be visible only at creation time and must never be copied into chat, email bodies, webhook payloads, examples, logs, or generated docs.

Treat verified sending domains, DNS records, and sender identities as account configuration. A valid API key is not enough to send safely; confirm the sender domain is verified and that the requested `from` address is authorized for that domain before `POST /emails` or batch/broadcast workflows.

## Secret Safety

- Store provider tokens, API keys, client secrets, refresh tokens, webhook secrets, signing secrets, private keys, and database/payment secrets only in ClawChat connections.
- Never display, summarize, forward, log, email, or write Resend API keys, webhook signing secrets, DNS secret values, or credential-shaped values into generated docs, comments, tickets, messages, files, email bodies, or tool output.
- If authentication fails, stop and ask the user to repair the connection. Do not request secret values in chat.
