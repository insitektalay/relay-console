# Resend API Overview

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://resend.com/docs/api-reference/introduction
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/api-reference/rate-limit
- https://resend.com/docs/dashboard/webhooks/introduction
- https://resend.com/docs/api-reference/errors

## Provider Object Model

- Email with id, from, to, cc, bcc, subject, html/text, reply_to, attachments, headers, tags
- Domain with verification status and DNS records
- API key resource with name/permission metadata but never secret value after creation
- Audience and contact records for subscribed recipients
- Broadcast/campaign style sends where enabled
- Webhook endpoint and event types

## Endpoint/Method Families

- POST /emails, GET /emails/{id}, POST /emails/batch
- GET/POST /domains, GET/PATCH/DELETE /domains/{id}, POST /domains/{id}/verify
- GET/POST /api-keys and DELETE /api-keys/{id}
- GET/POST /audiences, GET/POST/PATCH/DELETE contacts within audiences
- Webhook event delivery endpoints configured in dashboard/API where supported
