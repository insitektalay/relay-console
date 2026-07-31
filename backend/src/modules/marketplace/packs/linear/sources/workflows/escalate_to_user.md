# Linear Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Linear credentials are missing, OAuth/API-key scopes are insufficient, issue/team/project/cycle/state/user ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk issue data, Linear returns conflicting state, or official docs do not cover the requested GraphQL query or mutation.

## Approval-Required Patterns

- Bulk issue updates, cross-team reassignment, moving many issues between workflow states, archiving issues, project status/date changes, and workspace webhook changes require approval.
- Creating public/customer-facing issue content or importing large backlogs requires approval.
- Changing workflow configuration, teams, labels, or project milestones requires approval.

## Blocked Patterns

- Exposing API keys/OAuth secrets, deleting workspaces, changing billing/admin settings, or bulk exporting private issue data is blocked.
- Do not fabricate issue identifiers or team keys; query them.
- Do not close or cancel issues without approval unless the user clearly authorized the exact issue.
