# PostHog Workflow Router

Use PostHog for developer operations involving events, persons, insights, funnels, cohorts, feature flags, dashboards, projects.

Do not use PostHog for unrelated CRM, email, or payment workflows. Production deploy/configuration changes require explicit approval.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://posthog.com/docs/api
- https://posthog.com/docs/api/overview#authentication
- https://posthog.com/docs/api/overview#private-projects
- https://posthog.com/docs/api/projects
- https://posthog.com/docs/api/overview#rate-limits
- https://posthog.com/docs/api/overview#errors
- https://posthog.com/docs/cdp

## Routing Doctrine

1. Confirm the connected PostHog project id, personal/project API key context, insight/funnel/cohort/feature-flag ids, event/person filters, and destination/webhook target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve PostHog project id, organization/project context, insight id, dashboard id, cohort id, feature-flag key/id, person distinct id, event filter, session/replay id, and CDP destination/webhook id from read APIs before mutating anything.
4. Draft feature-flag changes, cohort/list changes, dashboard sharing, insight edits, person/event exports, CDP destination/webhook changes, project settings, permission changes, and destructive operations for approval.
5. Record PostHog project id, resource id/key, query filters, request intent, approval id, and safe response summaries after approved writes.

## When To Use

Use PostHog for developer operations involving events, persons, insights, funnels, cohorts, feature flags, dashboards, projects.

## When Not To Use

Do not use PostHog for unrelated CRM, email, or payment workflows. Production deploy/configuration changes require explicit approval.
