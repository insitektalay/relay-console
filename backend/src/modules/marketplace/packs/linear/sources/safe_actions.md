# Linear Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Resolve the team by key/name, then query its workflow states before creating or moving issues.
- For status reports, query issues with team/project/cycle filters and include state, priority, assignee, labels, and updatedAt.
- When summarizing comments, query the issue by identifier and fetch comments in chronological order.

## Approval Required

- Bulk issue updates, cross-team reassignment, moving many issues between workflow states, archiving issues, project status/date changes, and workspace webhook changes require approval.
- Creating public/customer-facing issue content or importing large backlogs requires approval.
- Changing workflow configuration, teams, labels, or project milestones requires approval.

## Blocked

- Exposing API keys/OAuth secrets, deleting workspaces, changing billing/admin settings, or bulk exporting private issue data is blocked.
- Do not fabricate issue identifiers or team keys; query them.
- Do not close or cancel issues without approval unless the user clearly authorized the exact issue.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
