# Resend API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://resend.com/docs/api-reference/introduction
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/api-reference/rate-limit
- https://resend.com/docs/dashboard/webhooks/introduction
- https://resend.com/docs/api-reference/errors

Resend uses API keys passed as bearer tokens. Keys are created in the Resend dashboard and must be stored only in ClawChat connections. Domain verification and DNS records are account configuration, not chat-visible secrets.

Send Resend API requests with the connector-held bearer API key. Preserve the account context, key id/name metadata where available, and operational policy attached to the connection. Do not infer missing Resend credentials from user text; if authentication fails, ask the user to repair the Resend connection or create a narrower API key in the Resend dashboard.
