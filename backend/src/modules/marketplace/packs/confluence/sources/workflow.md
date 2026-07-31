# Confluence Workflow Router

Use Confluence for knowledge/document operations involving spaces, pages, content, attachments, labels, versions, comments, whiteboards.

Do not use Confluence as an unrestricted database dump, chat system, or source-control replacement.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
- https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
- https://developer.atlassian.com/platform/forge/manifest-reference/scopes-product-confluence/
- https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/
- https://developer.atlassian.com/cloud/confluence/rate-limiting/
- https://developer.atlassian.com/cloud/confluence/modules/webhook/

## Routing Doctrine

1. Confirm the connected Confluence site, space key/id, page id, attachment id, label/comment target, version, Atlassian OAuth/API-token scope, and webhook target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Confluence site/cloud id, space ids/keys, page ids, parent page ids, attachment ids, label ids/names, version numbers, comment ids, whiteboard ids, and webhook ids from Confluence APIs before mutating anything.
4. Draft page publish/update/archive/delete, attachment upload/delete, label changes, page moves, permission/restriction changes, space changes, public/external sharing, webhook changes, and bulk page operations for approval.
5. Record Confluence site, space key/id, page/attachment/comment/version/webhook ids, changed content summary, approval id, and safe response summaries after approved writes.

## When To Use

Use Confluence for knowledge/document operations involving spaces, pages, content, attachments, labels, versions, comments, whiteboards.

## When Not To Use

Do not use Confluence as an unrestricted database dump, chat system, or source-control replacement.
