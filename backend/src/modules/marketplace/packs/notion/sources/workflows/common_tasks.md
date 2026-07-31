# Notion Common Workflows

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

- Use search only to discover accessible pages/databases, then fetch the specific page or database before acting.
- For page content, walk block children recursively and preserve block order; do not flatten checkboxes, toggles, or code blocks into ambiguous prose.
- For database queries, apply explicit filter and sort objects; validate property names against the database schema before querying.
- Create pages only under an explicit parent page or database and set required properties according to the database schema.
- Append blocks in small batches with exact rich_text and block types; do not overwrite existing block trees when appending is intended.
- Update page properties only after confirming property type and target page id; relation and rollup fields need extra confirmation.
