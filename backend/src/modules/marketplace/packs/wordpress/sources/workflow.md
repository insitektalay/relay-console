# WordPress Workflow Router

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.wordpress.org/rest-api/
- https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/
- https://developer.wordpress.org/rest-api/reference/posts/
- https://developer.wordpress.org/rest-api/reference/pages/
- https://developer.wordpress.org/rest-api/reference/media/
- https://developer.wordpress.org/rest-api/reference/comments/
- https://developer.wordpress.org/rest-api/reference/users/

## Routing Doctrine

1. Confirm the workspace/account, auth type, scopes, target IDs, visibility, and selected approval profile before using provider tools.
2. Prefer reads, summaries and drafts. External posts, public publishing, uploads, deletes, permission changes, webhooks and exports of private/customer content require approval.
3. Resolve provider object IDs from read APIs before constructing writes. Never infer IDs from names alone.
4. Keep secrets in ClawChat connection storage only. Do not print access tokens, refresh tokens, app secrets, API keys, bot tokens or webhook secrets.
5. For approved writes, log target IDs, request intent, human approval reference and a redacted provider response summary.

## Use WordPress For

- posts, pages, revisions and statuses draft/pending/private/publish
- media attachments and upload metadata
- users, roles and capabilities
- comments and moderation state
- categories, tags and taxonomies
- custom post types exposed with show_in_rest
- settings, plugins and themes when endpoints are installed/enabled

## Do Not Use WordPress For

- Bypassing provider permissions, sharing boundaries or channel/site ownership rules.
- Unrelated CRM, payment, infrastructure or source-control tasks.
- Public publishing or community messaging without explicit approval.
