# ClickUp Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Resolve ClickUp team, space, folder, list, task, status, assignee, custom-field, and doc ids before querying.
- Read current status/state/assignee/labels before proposing changes.
- Use bounded ClickUp task/list filters for reports and preserve task ids and custom-field ids.

## Approval Required

- Bulk transitions, deletes/archives, project configuration, workflow/status changes, external/customer-visible comments, and webhook changes require approval.

## Blocked

- Token exposure, workspace/project deletion, bypassing permissions, mass private-data export, and hidden status changes are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
