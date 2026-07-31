# Confluence Endpoint Families

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

- `GET/POST /wiki/api/v2/pages` with space id, parent id, title, body representation, status, and pagination.
- `GET/PATCH /wiki/api/v2/pages/{id}` with version number checks for updates.
- `GET /wiki/api/v2/spaces` and space lookup by key/id.
- Attachment endpoints for upload/list/download/delete on pages.
- Labels, comments, versions, ancestors/descendants, and whiteboards endpoints where enabled.
- Confluence webhook modules/endpoints for page, blog, attachment, comment, and space events.

## Read Method Doctrine

- Inspect Confluence space, page, parent, version, label, attachment, and restriction metadata before reading full content.
- Use title/space filters, CQL/search where available, body-format choices, and bounded pagination.
- Preserve page ids, space keys, parent ids, version numbers, attachment ids, labels, and comment ids in summaries.

## Write Method Doctrine

- Draft exact Confluence page create/update/archive, title, parent, body representation, version, label, attachment, comment, restriction, or webhook payloads.
- Validate page version number and parent/space permissions before updating content.
- Bulk page operations must be chunked and audited.
