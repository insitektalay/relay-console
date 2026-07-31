# Resend Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://resend.com/docs/api-reference/introduction
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/api-reference/rate-limit
- https://resend.com/docs/dashboard/webhooks/introduction
- https://resend.com/docs/api-reference/errors

- POST /emails, GET /emails/{id}, POST /emails/batch
- GET/POST /domains, GET/PATCH/DELETE /domains/{id}, POST /domains/{id}/verify
- GET/POST /api-keys and DELETE /api-keys/{id}
- GET/POST /audiences, GET/POST/PATCH/DELETE contacts within audiences
- Webhook event delivery endpoints configured in dashboard/API where supported
- Broadcast endpoints where enabled for audience-driven sends

## Read Method Doctrine

- Retrieve an email by id before reporting delivery status.
- Check domain verification before sending from a domain; explain required DNS records without exposing secrets.
- List audiences/contacts only for a bounded user request and avoid exporting full recipient lists.

## Write Method Doctrine

- Build a complete send payload with from, recipients, subject, html/text, reply_to, and idempotency/audit context before POST /emails.
- Use batch send only for explicitly approved recipient sets and compliant transactional use.
- Create or update domains, contacts, audiences, or API keys only after approval and audit.
- For webhook endpoint changes, show the event types, destination URL owner, signing-secret handling, and retry/audit impact before saving.
