# Trello Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/trello/rest/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
- https://developer.atlassian.com/cloud/trello/rest/api-group-cards/

## Provider Permission Model

Relevant permissions include read, write, account permissions through token. Project/admin and bulk-update permissions require approval.

## Capability Mapping

- Read capability: use Trello boards, lists, cards, checklists, checkItems, members, labels, actions, attachments, custom fields, and webhooks with bounded board/list/card queries.
- Draft capability: prepare exact Trello card create/update/move/archive, checklist/checkItem, comment/action, label/member, attachment, custom-field, board/list, or webhook payloads without side effects.
- Write capability: create/update/move Trello cards, comments, labels, checklists, attachments, and list membership only when API token permissions and approval policy allow it.
- Admin capability: Trello board closure/deletion, workspace/board permissions, webhooks, power-up/custom-field configuration, bulk card moves, and destructive board/list/card operations; disabled by default.
