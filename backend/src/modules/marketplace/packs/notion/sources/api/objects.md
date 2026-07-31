# Notion Object Model

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

- Page with parent, archived flag, icon, cover, properties, and child blocks
- Database or data source with schema properties, filters, sorts, and relation/rollup behavior
- Block tree including paragraph, heading, list, to_do, code, child_page, table, synced block, file, and embed blocks
- Comment thread on page/block
- User and bot integration identity
- Property values with typed constraints: title, rich_text, select, multi_select, relation, date, number, checkbox, status
- Parent relationship: page parent, database parent, workspace parent, and child-page/block nesting. Sharing/access often follows the parent tree.
- Database query model: explicit `filter`, `sorts`, pagination cursor, page size, and schema-valid property references.
- Integration capability model: read content, insert content, update content, comment, and webhook capabilities where enabled.
