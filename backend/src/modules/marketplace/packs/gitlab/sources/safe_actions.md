# GitLab Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Resolve GitLab host, group/project id or path, branch/ref, MR IID, issue IID, pipeline/job id, and environment before querying.
- Inspect current deployment/pipeline/issue/event/config state before proposing action.
- Limit logs/events to the requested time window and redact secrets.

## Approval Required

- Production deploys, env var/secret changes, webhook changes, feature flag toggles, project deletes, and bulk updates require approval.

## Blocked

- Secret exposure, project/org deletion, disabling security/audit controls, unapproved production changes, and broad source/log exports are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
