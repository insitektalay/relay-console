# Notion Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Use search only to discover accessible pages/databases, then fetch the specific page or database before acting.
- For page content, walk block children recursively and preserve block order; do not flatten checkboxes, toggles, or code blocks into ambiguous prose.
- For database queries, apply explicit filter and sort objects; validate property names against the database schema before querying.
- Draft page-create, page-property update, block-append, comment, and database-query payloads without writing them to Notion.

## Approval Required

- Publishing externally, sharing pages/databases, changing database schema, archiving pages with many children, or bulk updating database rows requires approval.
- Writing into company policy, legal, finance, security, HR, or public documentation requires approval.
- Adding comments that mention users or request action from people requires approval if customer/external visible.
- Expanding integration capabilities, adding a webhook subscription, changing a data-source schema, updating relation/rollup/status properties, or moving content between parents requires approval.

## Blocked

- Exposing integration tokens, OAuth client secrets, private page contents outside authorized users, or hidden database data is blocked.
- Workspace deletion, bypassing sharing restrictions, scraping inaccessible pages, and mass-exporting the workspace are blocked.
- Do not claim a page/database does not exist until access restrictions have been considered.
- Do not overwrite a block tree when the user asked to append, silently change property types/options, publish private workspace content, or infer hidden relation targets.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
