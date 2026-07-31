# Canva Workflow Router

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

## Routing Doctrine

1. Confirm the workspace/account, auth type, scopes, target IDs, visibility, and selected approval profile before using provider tools.
2. Prefer reads, summaries and drafts. External posts, public publishing, uploads, deletes, permission changes, webhooks and exports of private/customer content require approval.
3. Resolve provider object IDs from read APIs before constructing writes. Never infer IDs from names alone.
4. Keep secrets in ClawChat connection storage only. Do not print access tokens, refresh tokens, app secrets, API keys, bot tokens or webhook secrets.
5. For approved writes, log target IDs, request intent, human approval reference and a redacted provider response summary.

## Use Canva For

- designs and design imports
- folders and folder permissions
- assets/uploads for image, audio and video files
- brand templates and brand-template content
- comments, replies and collaboration notifications
- export jobs with temporary download URLs

## Do Not Use Canva For

- Bypassing provider permissions, sharing boundaries or channel/site ownership rules.
- Unrelated CRM, payment, infrastructure or source-control tasks.
- Public publishing or community messaging without explicit approval.
