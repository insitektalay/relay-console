# Trello Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/trello/rest/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/
- https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
- https://developer.atlassian.com/cloud/trello/rest/api-group-cards/

- `GET /1/boards/{id}`, board lists, members, labels, actions, and custom fields.
- `GET/POST /1/cards`, `GET/PUT /1/cards/{id}`, card comments/actions, attachments, labels, members, and due dates.
- Card movement via `idList`/position updates and archive/close operations.
- Checklist and checkItem endpoints for card checklists.
- Webhook endpoints using Trello model ids such as board or card ids.

## Read Method Doctrine

- Resolve Trello workspace, board, list, card, checklist, member, and label ids before querying.
- Read current card list, members, labels, due date, checklists, custom fields, and closed/archive state before proposing changes.
- Use bounded board/list/card queries and preserve Trello ids and shortLinks.

## Write Method Doctrine

- Create cards with explicit board/list id, name, description, members, labels, due date, position, checklist, and attachment context.
- Move cards only after confirming source and destination list ids.
- Add comments/actions with clear source context; do not use Trello comments as hidden approval.
