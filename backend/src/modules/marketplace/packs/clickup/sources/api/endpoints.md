# ClickUp Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.clickup.com/docs
- https://developer.clickup.com/docs/authentication
- https://developer.clickup.com/reference
- https://developer.clickup.com/docs/webhooks
- https://developer.clickup.com/docs/rate-limits

- `GET /team` for accessible ClickUp teams/workspaces.
- Space, folder, and list endpoints for hierarchy discovery.
- `GET/POST /list/{list_id}/task`, `GET/PUT /task/{task_id}`, task comments, attachments, tags, dependencies, time estimates, due dates, and priorities.
- Custom field endpoints for task field values.
- Docs, users, goals, and views endpoints where enabled.
- Webhook endpoints for task/list/folder/space events.

## Read Method Doctrine

- Resolve ClickUp team, space, folder, list, task, status, assignee, custom-field, and doc ids before querying.
- Read current task status, assignees, priority, due date, tags, custom fields, dependencies, list membership, and permissions before proposing changes.
- Use bounded ClickUp task/list filters for reports and preserve task ids and custom-field ids.

## Write Method Doctrine

- Create tasks with explicit team/list id, name, description, assignees, priority, due date, tags, status, and custom-field values.
- Update status/assignee only after confirming valid statuses for the task's list.
- Add comments with clear source context; do not use comments as hidden approval.
