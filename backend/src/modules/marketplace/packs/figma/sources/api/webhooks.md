# Figma Webhooks And Events

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.figma.com/docs/rest-api/
- https://developers.figma.com/docs/rest-api/authentication/
- https://developers.figma.com/docs/rest-api/scopes/
- https://developers.figma.com/docs/rest-api/file-endpoints/
- https://developers.figma.com/docs/rest-api/webhooks/
- https://developers.figma.com/docs/rest-api/rate-limits/

## Provider Events

- Webhook V2 contexts are team, project, or file; creation depends on team admin, project Can edit, or file Can edit permission.
- Useful events include file version update, file delete, library publish, comment, dev resource, and webhook ping where available.
- Documented limits include 20 team webhooks per team, 5 project webhooks per project, and 3 file webhooks per file, with plan-level file webhook caps.

## Safety Rules

- Creating, changing or deleting webhook subscriptions requires approval.
- Validate signatures/secrets where the provider supports them.
- Redact webhook URLs, signing secrets and delivery payload secrets.
- Dedupe retries and avoid sending private payloads to unapproved external destinations.
