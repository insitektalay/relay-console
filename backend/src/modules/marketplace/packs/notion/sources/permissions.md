# Notion Permissions and Scopes

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

## Provider Permission Model

Notion capabilities govern read content, insert content, update content, and comments. Database/page access is constrained by parent sharing; missing objects often mean the integration lacks access rather than the object not existing. Do not request broader workspace access unless the user intentionally re-authorizes the integration.

Shared access is inherited through parent pages/databases only where Notion sharing permits it. A child page, linked database view, relation target, file block, synced block, or page mention may point at content that the integration cannot read. Treat partial reads as authorization boundaries, not as permission to scrape or infer hidden content.

Database queries must respect the database/data-source schema. Validate property names, property ids, property types, relation targets, rollups, formulas, status/select options, filters, and sorts before creating or updating pages in a database.

## Capability Mapping

- Read capability: search accessible pages/databases/data sources, retrieve page properties, query databases with explicit filter/sort objects, and walk block children that the integration can access.
- Draft capability: prepare exact page-create, page-property update, block append, comment, or database-query payloads without changing Notion content.
- Write capability: create pages under an explicit parent, append/update blocks, update page properties, and add comments only when integration capabilities and page/database sharing allow it.
- Admin capability: integration capability expansion, database/data-source schema changes, page/database sharing changes, webhook subscriptions, page archive/delete workflows, comment moderation, and bulk database updates; disabled by default.
