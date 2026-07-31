# Notion Read Workflows

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
- For page properties, retrieve the page first, then use property-item retrieval when a property is large, paginated, or relation-heavy.
- For blocks, recurse through child blocks only within the requested page/tree and preserve Notion block ids for follow-up writes.

Always use explicit Notion ids or narrow Notion search/query filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, or private workspace data.
