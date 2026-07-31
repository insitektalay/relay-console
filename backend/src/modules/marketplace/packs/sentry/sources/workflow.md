# Sentry Workflow Router

Use Sentry for developer operations involving organizations, projects, issues, events, releases, alerts, teams, webhooks.

Do not use Sentry for unrelated CRM, email, or payment workflows. Production deploy/configuration changes require explicit approval.

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

## Routing Doctrine

1. Confirm the connected Sentry organization slug, project slug, issue/event/release ids, team, auth-token scope, alert/webhook target, and time window before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Sentry organization slug, project slug, issue id, event id, release version, team slug, alert rule id, and webhook/integration id from read APIs before mutating anything.
4. Draft issue-state changes, alert-rule edits, release/deploy metadata changes, team/project configuration, integration/webhook changes, member/permission changes, bulk issue operations, and destructive operations for approval.
5. Record Sentry org/project slug, issue/event/release ids, request intent, approval id, and safe response summaries after approved writes.

## When To Use

Use Sentry for developer operations involving organizations, projects, issues, events, releases, alerts, teams, webhooks.

## When Not To Use

Do not use Sentry for unrelated CRM, email, or payment workflows. Production deploy/configuration changes require explicit approval.
