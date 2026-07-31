# Sentry Read Workflows

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

Always use explicit Sentry organization slugs, project slugs, issue ids, event ids, release versions, alert rule ids, team slugs, webhook ids, or narrow Sentry search filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, stack-trace, or private organization data.
