# Notion Workflow Router

Use Notion for workspace knowledge, pages, databases, data sources, blocks, comments, page properties, and structured notes where the integration has been explicitly granted access.

Do not use Notion for source control, transactional email, real-time incident chat, hidden databases not shared with the integration, or requests to bypass page/database sharing and workspace access boundaries.

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

## Routing Doctrine

1. Confirm the connected Notion workspace, integration identity, shared parent page or database/data source, target page/block/comment id, and whether the integration has access through parent/child sharing before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Notion page ids, database ids, block ids, data-source ids, property ids/names, and comment parent ids from Notion read APIs before mutating anything.
4. Draft page sharing/publication, database/data-source schema changes, property migrations, bulk database-row updates, page archives, comment mentions, webhook subscriptions, and integration capability expansions for approval.
5. Record Notion ids, parent relationship, changed property/block/comment payload, approval id, and safe response summaries after approved writes.

## When To Use

Use Notion for workspace knowledge, pages, databases, data sources, blocks, comments, page properties, and structured notes where the integration has been explicitly granted access.

## When Not To Use

Do not use Notion for source control, transactional email, real-time incident chat, hidden databases not shared with the integration, or requests to bypass page/database sharing and workspace access boundaries.
