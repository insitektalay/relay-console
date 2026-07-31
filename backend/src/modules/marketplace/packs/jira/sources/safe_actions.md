# Jira Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Resolve Jira Cloud site, project key, issue key/id, board id, sprint id, and accountId before querying.
- Read current status/state/assignee/labels before proposing changes.
- Use bounded JQL for reports and preserve Jira issue keys, ids, and field ids.

## Approval Required

- Bulk transitions, deletes/archives, project configuration, workflow/status changes, external/customer-visible comments, and webhook changes require approval.

## Blocked

- Token exposure, workspace/project deletion, bypassing permissions, mass private-data export, and hidden status changes are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
