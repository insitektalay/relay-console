# Sentry Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.sentry.io/api/
- https://docs.sentry.io/api/auth/
- https://docs.sentry.io/api/permissions/
- https://docs.sentry.io/api/events/
- https://docs.sentry.io/api/ratelimits/
- https://docs.sentry.io/organization/integrations/integration-platform/webhooks/

## Provider Permission Model

Relevant permissions include Sentry token/OAuth scopes such as `org:read`, `org:write`, `project:read`, `project:write`, `project:admin`, `event:read`, `team:read`, `team:write`, `member:read`, `member:write`, and integration/webhook permissions. Issue mutation, alert-rule changes, project/team administration, webhook changes, and member/permission changes are high-risk.

## Capability Mapping

- Read capability: query bounded Sentry organizations, projects, issues, events, releases, deploys, teams, alert rules, and integration/webhook metadata; summarize stack traces/events with privacy redaction.
- Draft capability: prepare exact Sentry issue-state, assignment, release/deploy metadata, alert-rule, team/project, or webhook payloads without side effects.
- Write capability: update selected Sentry issues, releases, alert rules, teams, projects, or webhooks only inside the authorized organization/project and active approval policy.
- Admin capability: Sentry project deletion, team/member permission changes, alert-rule disablement, webhook/integration management, bulk issue state changes, privacy-sensitive event exports, billing/org settings, and destructive operations; disabled by default.
