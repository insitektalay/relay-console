# Canva Webhooks And Events

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.canva.dev/docs/connect/
- https://www.canva.dev/docs/connect/authentication/
- https://www.canva.dev/docs/connect/appendix/scopes/
- https://www.canva.dev/docs/connect/canva-concepts/
- https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/
- https://www.canva.dev/docs/connect/webhooks/

## Provider Events

- Canva Connect supports collaboration/event webhook notifications for integrations with the collaboration:event scope.
- Webhook receivers must validate event source, handle retries/idempotency, and avoid storing exported file URLs beyond their useful lifetime.

## Safety Rules

- Creating, changing or deleting webhook subscriptions requires approval.
- Validate signatures/secrets where the provider supports them.
- Redact webhook URLs, signing secrets and delivery payload secrets.
- Dedupe retries and avoid sending private payloads to unapproved external destinations.
