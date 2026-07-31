# Resend Workflow Router

Use Resend for transactional and product email operations: sending approved emails, drafting payloads, checking domains, API keys, audiences, contacts, broadcasts, webhook event delivery, and email status.

Do not use Resend for unsolicited bulk marketing, inbox reading, support-ticket threads, or any workflow that needs Gmail/Outlook mailbox state rather than outbound email delivery.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://resend.com/docs/api-reference/introduction
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/api-reference/rate-limit
- https://resend.com/docs/dashboard/webhooks/introduction
- https://resend.com/docs/api-reference/errors

## Routing Doctrine

1. Confirm the connected Resend account, API key scope, sending domain, verified sender, email id, audience/contact id, and webhook endpoint before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Resend email ids, domain ids/names, DNS verification records, API-key ids, audience ids, contact ids, broadcast ids, and webhook endpoint ids from Resend APIs before mutation.
4. Draft live sends, batch sends, broadcasts, sender-domain mutations, contact/audience imports, API-key creation/deletion, webhook changes, attachment sends, and customer-facing email content for approval.
5. Record Resend ids, sender domain, recipient set, endpoint path, approval id, and safe delivery/status summaries after approved writes.

## When To Use

Use Resend for transactional and product email operations: sending approved emails, drafting payloads, checking domains, API keys, audiences, contacts, broadcasts, webhook event delivery, and email status.

## When Not To Use

Do not use Resend for unsolicited bulk marketing, inbox reading, support-ticket threads, or any workflow that needs Gmail/Outlook mailbox state rather than outbound email delivery.
