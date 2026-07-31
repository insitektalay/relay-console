# ClickUp Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when ClickUp credentials are missing, OAuth/token access is insufficient, team/space/folder/list/task/custom-field/doc ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk task/doc data, ClickUp returns conflicting task/list state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Bulk transitions, deletes/archives, project configuration, workflow/status changes, external/customer-visible comments, and webhook changes require approval.

## Blocked Patterns

- Token exposure, workspace/project deletion, bypassing permissions, mass private-data export, and hidden status changes are blocked.
