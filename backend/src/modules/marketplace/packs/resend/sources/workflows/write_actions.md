# Resend Write Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://resend.com/docs/api-reference/introduction
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/api-reference/rate-limit
- https://resend.com/docs/dashboard/webhooks/introduction
- https://resend.com/docs/api-reference/errors

- Build a complete send payload with from, recipients, subject, html/text, reply_to, and idempotency/audit context before POST /emails.
- Use batch send only for explicitly approved recipient sets and compliant transactional use.
- Create or update domains, contacts, audiences, or API keys only after approval and audit.
- For each live send, show sender domain verification, `from`, `to`/`cc`/`bcc`, subject, html/text summary, attachment names, tags, and idempotency/audit context.
- For contacts and audiences, confirm opt-in/source-of-truth and list membership before create/update/delete/import.

Before execution, show the Resend email/domain/audience/contact/API-key/webhook ids, endpoint path, changed fields, recipient and customer impact, rollback expectations, approval requirement, and audit note.
