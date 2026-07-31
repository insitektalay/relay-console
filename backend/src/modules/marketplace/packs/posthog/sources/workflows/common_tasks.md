# PostHog Common Workflows

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

- Resolve PostHog project id, region/host, insight id, dashboard id, cohort id, feature-flag key/id, event name, person distinct id, group key, session/replay id, and CDP destination/webhook id before querying.
- Inspect current feature-flag filters/rollout, cohort definition, insight query, dashboard sharing state, event/person filters, project privacy settings, and destination/webhook configuration before proposing action.
- Limit event/person/session reads to requested filters, properties, and time windows; redact API keys, distinct ids where not needed, emails, IPs, session URLs, and other PII.
- Draft exact PostHog payloads for feature flags, cohorts, insights, dashboards, annotations, project settings, exports, and CDP destination/webhook changes.
- Prefer inactive/test feature flags, internal cohorts, and draft dashboard/insight changes before affecting production users.
- Audit every feature-flag rollout change, cohort rule/membership change, person/event export, dashboard public share, CDP destination/webhook change, project setting change, or destructive mutation.
