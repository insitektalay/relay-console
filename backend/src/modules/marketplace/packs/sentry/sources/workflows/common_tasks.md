# Sentry Common Workflows

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

- Resolve Sentry organization slug, project slug/id, issue id, event id, release version, environment, team slug, alert rule id, integration id, and webhook id before querying.
- Inspect current issue status, assignee, tags, event sample, release/deploy state, alert rule condition, team/project membership, and webhook subscription before proposing action.
- Limit event and stack-trace reads to requested projects, issue ids, environments, releases, and time windows; redact PII, tokens, request headers, breadcrumbs, and secrets.
- Draft exact Sentry payloads for issue status/assignment/comments, release/deploy metadata, alert rules, project/team settings, integration configuration, or webhooks.
- Prefer reads and draft summaries before changing issue state, alert rules, teams, or project settings.
- Audit every bulk issue update, alert-rule change, release/deploy metadata change, webhook/integration change, team/member change, project deletion, or privacy-sensitive export.
