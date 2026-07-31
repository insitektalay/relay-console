# Resend Common Workflows

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
- Build a complete send payload with from, recipients, subject, html/text, reply_to, and idempotency/audit context before POST /emails.
- Use batch send only for explicitly approved recipient sets and compliant transactional use.
- Create or update domains, contacts, audiences, or API keys only after approval and audit.
