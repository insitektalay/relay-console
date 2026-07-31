# PostHog Endpoint Families

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

- Project endpoints for PostHog projects, private-project access, and project settings.
- Events/persons endpoints for event names, event properties, person records, groups, and filtered person/event reads.
- Query and insight endpoints for HogQL/query API usage, insights, funnels, trends, retention, paths, dashboards, and saved insight metadata.
- Feature flag and experiment endpoints for flag keys, filters, rollout percentages, variants, and active/inactive state.
- Cohort endpoints for cohort definitions, filters, memberships where available, and behavioral/person-property rules.
- Session replay, annotation, dashboard, and subscription endpoints where enabled by project and token permissions.
- CDP destination, webhook, and data pipeline endpoints documented in PostHog CDP docs.

## Read Method Doctrine

- Resolve PostHog project id, region/host, insight id, dashboard id, cohort id, feature-flag key/id, event name, person distinct id, group key, session/replay id, and CDP destination/webhook id before querying.
- Inspect current feature-flag filters/rollout, cohort definition, insight query, dashboard sharing state, event/person filters, project privacy settings, and destination/webhook configuration before proposing action.
- Limit event/person/session reads to requested filters, properties, and time windows; redact API keys, distinct ids where not needed, emails, IPs, session URLs, and other PII.

## Write Method Doctrine

- Draft exact PostHog payloads for feature flags, cohorts, insights, dashboards, annotations, project settings, exports, and CDP destination/webhook changes.
- Prefer inactive/test feature flags, internal cohorts, and draft dashboard/insight changes before affecting production users.
- Audit every feature-flag rollout change, cohort rule/membership change, person/event export, dashboard public share, CDP destination/webhook change, project setting change, or destructive mutation.
