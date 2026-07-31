# Asana Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Asana credentials are missing, OAuth/PAT access is insufficient, workspace/project/section/task/story/user/custom-field GIDs are ambiguous, the operation is approval-required, the request touches secrets or high-risk task data, Asana returns conflicting task/project state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Bulk transitions, deletes/archives, project configuration, workflow/status changes, external/customer-visible comments, and webhook changes require approval.

## Blocked Patterns

- Token exposure, workspace/project deletion, bypassing permissions, mass private-data export, and hidden status changes are blocked.
