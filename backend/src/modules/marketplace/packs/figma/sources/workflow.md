# Figma Workflow Router

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

## Routing Doctrine

1. Confirm the workspace/account, auth type, scopes, target IDs, visibility, and selected approval profile before using provider tools.
2. Prefer reads, summaries and drafts. External posts, public publishing, uploads, deletes, permission changes, webhooks and exports of private/customer content require approval.
3. Resolve provider object IDs from read APIs before constructing writes. Never infer IDs from names alone.
4. Keep secrets in ClawChat connection storage only. Do not print access tokens, refresh tokens, app secrets, API keys, bot tokens or webhook secrets.
5. For approved writes, log target IDs, request intent, human approval reference and a redacted provider response summary.

## Use Figma For

- file keys from figma.com/file/{key} or design URLs
- files with DOCUMENT/CANVAS node trees
- nodes, components, component sets, styles, variables and versions
- comments, comment reactions and resolved state
- image/render export URLs
- teams, projects and webhook contexts

## Do Not Use Figma For

- Bypassing provider permissions, sharing boundaries or channel/site ownership rules.
- Unrelated CRM, payment, infrastructure or source-control tasks.
- Public publishing or community messaging without explicit approval.
