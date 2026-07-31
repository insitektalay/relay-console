# ClickUp Workflow Router

Use ClickUp for work-management operations involving teams, spaces, folders, lists, tasks, statuses, custom fields, comments, docs, webhooks.

Do not use ClickUp for source-code edits, billing, chat broadcasts, or documents that belong in a knowledge base unless linked to work items.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.clickup.com/docs
- https://developer.clickup.com/docs/authentication
- https://developer.clickup.com/reference
- https://developer.clickup.com/docs/webhooks
- https://developer.clickup.com/docs/rate-limits

## Routing Doctrine

1. Confirm the connected ClickUp workspace/team, space, folder, list, task id, status, custom field ids, assignee ids, OAuth/token scope, and webhook target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve ClickUp team/workspace ids, space ids, folder ids, list ids, task ids, status names, custom-field ids, assignee ids, comment ids, doc ids, and webhook ids from ClickUp APIs before mutating anything.
4. Draft bulk task changes, task deletes/archives, list/space/folder changes, status/custom-field changes, assignee changes, customer-visible comments, doc changes, and webhook changes for approval.
5. Record ClickUp team/space/folder/list/task/custom-field/comment/doc/webhook ids, changed fields, approval id, and safe response summaries after approved writes.

## When To Use

Use ClickUp for work-management operations involving teams, spaces, folders, lists, tasks, statuses, custom fields, comments, docs, webhooks.

## When Not To Use

Do not use ClickUp for source-code edits, billing, chat broadcasts, or documents that belong in a knowledge base unless linked to work items.
