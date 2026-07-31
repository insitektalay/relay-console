# Sentry Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Resolve Sentry organization slug, project slug/id, issue id, event id, release version, environment, team slug, alert rule id, integration id, and webhook id before querying.
- Inspect current issue status, assignee, tags, event sample, release/deploy state, alert rule condition, team/project membership, and webhook subscription before proposing action.
- Limit event and stack-trace reads to requested projects, issue ids, environments, releases, and time windows; redact PII, tokens, request headers, breadcrumbs, and secrets.

## Approval Required

- Bulk issue resolve/ignore/unresolve, alert-rule edits or disables, release/deploy metadata changes, webhook/integration changes, team/member changes, project deletion, and privacy-sensitive event exports require approval.

## Blocked

- Exposing Sentry auth tokens, DSNs marked private, event secrets, request headers, or PII; deleting org/project resources without a destructive approval path; disabling alerting/security controls; and broad event/source exports are blocked.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
