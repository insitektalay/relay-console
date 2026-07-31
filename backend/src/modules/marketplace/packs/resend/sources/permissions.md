# Resend Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://resend.com/docs/api-reference/introduction
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/api-reference/rate-limit
- https://resend.com/docs/dashboard/webhooks/introduction
- https://resend.com/docs/api-reference/errors

## Provider Permission Model

Resend API keys can be scoped by operational policy in ClawChat. Treat sending, domain changes, API key creation/deletion, audience/contact mutation, and broadcast scheduling as write/admin actions. Use the narrowest API key that supports the selected workflow.

## Capability Mapping

- Read capability: retrieve Resend emails by id, list/check sending domains and DNS verification, inspect API-key metadata, list bounded audiences/contacts, and review webhook configuration without exposing secrets.
- Draft capability: prepare exact `POST /emails`, `POST /emails/batch`, broadcast, contact/audience, domain, API-key, or webhook payloads without side effects.
- Write capability: send approved transactional emails, batch emails, or broadcasts and mutate contacts/audiences/domains only inside selected account policy and approval state.
- Admin capability: Resend API-key creation/deletion, domain create/delete/verify, webhook endpoint changes, broadcast scheduling, high-volume recipient changes, and billing/account configuration; disabled by default.
