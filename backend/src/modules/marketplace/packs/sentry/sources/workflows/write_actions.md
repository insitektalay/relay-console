# Sentry Write Workflows

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

- Draft exact Sentry payloads for issue status/assignment/comments, release/deploy metadata, alert rules, project/team settings, integration configuration, or webhooks.
- Prefer reads and draft summaries before changing issue state, alert rules, teams, or project settings.
- Audit every bulk issue update, alert-rule change, release/deploy metadata change, webhook/integration change, team/member change, project deletion, or privacy-sensitive export.

Before execution, show the Sentry org/project/issue/event/release/alert/team/webhook ids, changed fields, alerting/customer/privacy impact, rollback expectations, approval requirement, and audit note.
