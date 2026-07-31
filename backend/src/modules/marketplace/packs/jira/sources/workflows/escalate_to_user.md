# Jira Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Jira credentials are missing, Atlassian scopes/project permissions are insufficient, issue/project/board/sprint/transition/account ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk issue data, Jira returns conflicting workflow state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Bulk transitions, deletes/archives, project configuration, workflow/status changes, external/customer-visible comments, and webhook changes require approval.

## Blocked Patterns

- Token exposure, workspace/project deletion, bypassing permissions, mass private-data export, and hidden status changes are blocked.
