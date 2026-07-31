# Asana Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.asana.com/docs
- https://developers.asana.com/docs/authentication
- https://developers.asana.com/docs/oauth
- https://developers.asana.com/reference/rest-api-reference
- https://developers.asana.com/docs/webhooks-guide
- https://developers.asana.com/docs/rate-limits
- https://developers.asana.com/docs/errors

- `GET/POST /tasks` with workspace/project/assignee/completed filters and `opt_fields`.
- `GET/PUT /tasks/{task_gid}`, subtasks, dependencies, attachments, and memberships.
- `GET /projects/{project_gid}/tasks`, project, section, and team endpoints.
- `POST /tasks/{task_gid}/stories` for comments.
- Custom fields, portfolios, users, workspaces, and teams endpoints.
- Asana webhook endpoints for task/project changes.

## Read Method Doctrine

- Resolve Asana workspace, team, project, section, task, user, custom-field, and portfolio GIDs before querying.
- Read current completion state, assignee, due dates, memberships, custom fields, tags, and dependencies before proposing changes.
- Use bounded pagination and `opt_fields` for reports and preserve Asana GIDs.

## Write Method Doctrine

- Create tasks with explicit workspace, project/section memberships, name, notes, assignee, due date, tags, dependencies, and custom-field values.
- Update completion, assignee, due date, memberships, and custom fields only after reading current task state.
- Add stories/comments with clear source context; do not use comments as hidden approval.
