# Notion API Overview

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

## Provider Object Model

- Page with parent, archived flag, icon, cover, properties, and child blocks
- Database or data source with schema properties, filters, sorts, and relation/rollup behavior
- Block tree including paragraph, heading, list, to_do, code, child_page, table, synced block, file, and embed blocks
- Comment thread on page/block
- User and bot integration identity
- Property values with typed constraints: title, rich_text, select, multi_select, relation, date, number, checkbox, status

## Endpoint/Method Families

- POST /v1/search
- GET /v1/pages/{page_id}, PATCH /v1/pages/{page_id}, POST /v1/pages
- GET /v1/blocks/{block_id}/children, PATCH /v1/blocks/{block_id}, PATCH /v1/blocks/{block_id}/children
- POST /v1/databases/{database_id}/query and data-source query endpoints where available
- GET /v1/databases/{database_id}, PATCH /v1/databases/{database_id}
- GET /v1/comments, POST /v1/comments
- GET /v1/users, GET /v1/users/me
