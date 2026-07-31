# Sentry Endpoint Families

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

- `GET /api/0/organizations/{organization_slug}/issues/` for issue search using query, project, environment, and time filters.
- Issue endpoints for retrieve/update, status transitions such as resolve/ignore/unresolve where supported, assignment, comments, and event lists.
- Project endpoints under organizations/projects for project details, teams, keys, and configuration reads/updates where scoped.
- Event endpoints for issue events, event payloads, stack traces, breadcrumbs, tags, and user/context data with redaction.
- Release and deploy endpoints for release versions, commits, files, deploys, and adoption/error summaries.
- Alert-rule, team/member, integration, and webhook endpoints where enabled by token scope.
- Sentry integration platform webhook events for issues, errors, comments, metric alerts, and installation lifecycle events.

## Read Method Doctrine

- Resolve Sentry organization slug, project slug/id, issue id, event id, release version, environment, team slug, alert rule id, integration id, and webhook id before querying.
- Inspect current issue status, assignee, tags, event sample, release/deploy state, alert rule condition, team/project membership, and webhook subscription before proposing action.
- Limit event and stack-trace reads to requested projects, issue ids, environments, releases, and time windows; redact PII, tokens, request headers, breadcrumbs, and secrets.

## Write Method Doctrine

- Draft exact Sentry payloads for issue status/assignment/comments, release/deploy metadata, alert rules, project/team settings, integration configuration, or webhooks.
- Prefer reads and draft summaries before changing issue state, alert rules, teams, or project settings.
- Audit every bulk issue update, alert-rule change, release/deploy metadata change, webhook/integration change, team/member change, project deletion, or privacy-sensitive export.
