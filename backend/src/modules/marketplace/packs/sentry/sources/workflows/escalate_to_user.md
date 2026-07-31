# Sentry Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when Sentry credentials are missing, token scopes are insufficient, organization/project/issue/event identifiers are ambiguous, the operation is approval-required, the request touches PII or high-risk event data, Sentry returns conflicting issue/release/alert state, or official docs do not cover the requested action.

## Approval-Required Patterns

- Bulk issue resolve/ignore/unresolve, alert-rule edits or disables, release/deploy metadata changes, webhook/integration changes, team/member changes, project deletion, and privacy-sensitive event exports require approval.

## Blocked Patterns

- Exposing Sentry auth tokens, DSNs marked private, event secrets, request headers, or PII; deleting org/project resources without a destructive approval path; disabling alerting/security controls; and broad event/source exports are blocked.
