# PostHog Write Workflows

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

- Draft exact PostHog payloads for feature flags, cohorts, insights, dashboards, annotations, project settings, exports, and CDP destination/webhook changes.
- Prefer inactive/test feature flags, internal cohorts, and draft dashboard/insight changes before affecting production users.
- Audit every feature-flag rollout change, cohort rule/membership change, person/event export, dashboard public share, CDP destination/webhook change, project setting change, or destructive mutation.

Before execution, show the PostHog project/resource ids, feature-flag key or cohort/dashboard/insight/destination id, changed filters/rules/fields, affected users/events, privacy/customer impact, rollback expectations, approval requirement, and audit note.
