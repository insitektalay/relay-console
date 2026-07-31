# Notion Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Notion credentials are missing, integration capabilities are insufficient, page/database/block/comment ids are ambiguous, the parent page or database is not shared with the integration, the operation is approval-required, the request touches secrets or high-risk workspace data, Notion returns conflicting state, or official docs do not cover the requested action.

## Approval-Required Patterns

- Publishing externally, sharing pages/databases, changing database schema, archiving pages with many children, or bulk updating database rows requires approval.
- Writing into company policy, legal, finance, security, HR, or public documentation requires approval.
- Adding comments that mention users or request action from people requires approval if customer/external visible.
- Webhook subscriptions, integration capability expansion, relation/rollup/status-property changes, and parent moves require approval.

## Blocked Patterns

- Exposing integration tokens, OAuth client secrets, private page contents outside authorized users, or hidden database data is blocked.
- Workspace deletion, bypassing sharing restrictions, scraping inaccessible pages, and mass-exporting the workspace are blocked.
- Do not claim a page/database does not exist until access restrictions have been considered.
- Do not overwrite a block tree when the user asked to append, publish private workspace content, or infer hidden relation targets.
