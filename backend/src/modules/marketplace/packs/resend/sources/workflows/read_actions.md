# Resend Read Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://resend.com/docs/api-reference/introduction
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/api-reference/rate-limit
- https://resend.com/docs/dashboard/webhooks/introduction
- https://resend.com/docs/api-reference/errors

- Retrieve an email by id before reporting delivery status.
- Check domain verification before sending from a domain; explain required DNS records without exposing secrets.
- List audiences/contacts only for a bounded user request and avoid exporting full recipient lists.

Always use explicit Resend email ids, domain ids/names, audience ids, contact ids, broadcast ids, API-key ids, webhook endpoint ids, or narrow Resend list filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, or private recipient data.
