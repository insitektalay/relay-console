# Trello Read Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/trello/rest/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
- https://developer.atlassian.com/cloud/trello/rest/api-group-cards/

- Resolve Trello workspace, board, list, card, checklist, member, and label ids before querying.
- Read current status/state/assignee/labels before proposing changes.
- Use bounded board/list/card queries and preserve Trello ids and shortLinks.

Always use explicit Trello workspace/board/list/card/checklist/member/label/action/webhook ids or bounded board/list/card filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, or private board data.
