# Notion Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.notion.com/docs/getting-started
- https://developers.notion.com/docs/authorization
- https://developers.notion.com/docs/authorization#capabilities
- https://developers.notion.com/reference/intro
- https://developers.notion.com/reference/request-limits
- https://developers.notion.com/reference/status-codes
- https://developers.notion.com/reference/webhooks

- POST /v1/search
- GET /v1/pages/{page_id}, PATCH /v1/pages/{page_id}, POST /v1/pages
- GET /v1/pages/{page_id}/properties/{property_id}
- GET /v1/blocks/{block_id}/children, PATCH /v1/blocks/{block_id}, PATCH /v1/blocks/{block_id}/children, DELETE/archive block where supported
- POST /v1/databases/{database_id}/query and data-source query endpoints where available
- GET /v1/databases/{database_id}, PATCH /v1/databases/{database_id}
- GET /v1/comments, POST /v1/comments
- GET /v1/users, GET /v1/users/me
- Webhook subscription/event endpoints where enabled for the integration

## Read Method Doctrine

- Use search only to discover accessible pages/databases, then fetch the specific page or database before acting.
- For page content, walk block children recursively and preserve block order; do not flatten checkboxes, toggles, or code blocks into ambiguous prose.
- For database queries, apply explicit filter and sort objects; validate property names against the database schema before querying.
- For page properties that may be paginated or large, use the page-property endpoint instead of relying only on the page retrieve payload.

## Write Method Doctrine

- Create pages only under an explicit parent page or database and set required properties according to the database schema.
- Append blocks in small batches with exact rich_text and block types; do not overwrite existing block trees when appending is intended.
- Update page properties only after confirming property type and target page id; relation and rollup fields need extra confirmation.
- Add comments only to a clear page/block parent and require approval for mentions, customer-visible comments, or action-request comments.
