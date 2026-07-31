# Trello Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Trello credentials are missing, token access is insufficient, board/list/card/checklist/member/label ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk board data, Trello returns conflicting card/list state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Bulk transitions, deletes/archives, project configuration, workflow/status changes, external/customer-visible comments, and webhook changes require approval.

## Blocked Patterns

- Token exposure, workspace/project deletion, bypassing permissions, mass private-data export, and hidden status changes are blocked.
