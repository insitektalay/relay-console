# Webflow Workflow Router

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.webflow.com/data/reference/authentication
- https://developers.webflow.com/v2.0.0/data/reference/scopes
- https://developers.webflow.com/data/reference/cms/collection-items
- https://developers.webflow.com/data/reference/pages
- https://developers.webflow.com/data/reference/webhooks
- https://developers.webflow.com/data/v2.0.0/reference/rate-limits

## Routing Doctrine

1. Confirm the workspace/account, auth type, scopes, target IDs, visibility, and selected approval profile before using provider tools.
2. Prefer reads, summaries and drafts. External posts, public publishing, uploads, deletes, permission changes, webhooks and exports of private/customer content require approval.
3. Resolve provider object IDs from read APIs before constructing writes. Never infer IDs from names alone.
4. Keep secrets in ClawChat connection storage only. Do not print access tokens, refresh tokens, app secrets, API keys, bot tokens or webhook secrets.
5. For approved writes, log target IDs, request intent, human approval reference and a redacted provider response summary.

## Use Webflow For

- sites, workspaces and authorization info
- pages, page content and custom code
- collections, CMS fields and collection items
- assets in the Webflow asset manager
- forms and form submissions
- domains, site configuration and publish targets
- webhooks and trigger types

## Do Not Use Webflow For

- Bypassing provider permissions, sharing boundaries or channel/site ownership rules.
- Unrelated CRM, payment, infrastructure or source-control tasks.
- Public publishing or community messaging without explicit approval.
