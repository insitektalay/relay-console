# PostHog Read Workflows

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

Always use explicit PostHog project ids, insight ids, dashboard ids, cohort ids, feature-flag keys, event names, person/group identifiers, session ids, destination ids, or narrow PostHog query filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, raw-event, session-replay, or private project data.
