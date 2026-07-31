# GitLab Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when GitLab credentials are missing, token scopes/project permissions are insufficient, project/ref/MR/issue/pipeline/job ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk repository/CI data, GitLab returns conflicting branch/pipeline state, or official docs do not cover the requested endpoint.

## Approval-Required Patterns

- Production deploys, env var/secret changes, webhook changes, feature flag toggles, project deletes, and bulk updates require approval.

## Blocked Patterns

- Secret exposure, project/org deletion, disabling security/audit controls, unapproved production changes, and broad source/log exports are blocked.
