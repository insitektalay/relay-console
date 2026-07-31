# Trello Workflow Router

Use Trello for work-management operations involving boards, lists, cards, checklists, members, labels, actions, webhooks.

Do not use Trello for source-code edits, billing, chat broadcasts, or documents that belong in a knowledge base unless linked to work items.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/trello/rest/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
- https://developer.atlassian.com/cloud/trello/rest/api-group-cards/

## Routing Doctrine

1. Confirm the connected Trello workspace, board id, list id, card id, checklist id, member id, label id, API key/token scope, and webhook target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Trello workspace/organization ids, board ids, list ids, card ids, checklist ids, checkItem ids, member ids, label ids, action ids, and webhook ids from Trello APIs before mutating anything.
4. Draft bulk card moves, card archive/delete, board/list changes, checklist changes, member/label changes, customer-visible comments, webhook changes, and board permission changes for approval.
5. Record Trello board/list/card/checklist/member/label/webhook ids, changed fields, approval id, and safe response summaries after approved writes.

## When To Use

Use Trello for work-management operations involving boards, lists, cards, checklists, members, labels, actions, webhooks.

## When Not To Use

Do not use Trello for source-code edits, billing, chat broadcasts, or documents that belong in a knowledge base unless linked to work items.
