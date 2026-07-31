# PostHog Permissions and Scopes

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

## Provider Permission Model

Relevant permissions include PostHog personal API key scope, project membership, organization/project role, and private-project access. Person/event export, feature flag edits, cohort edits, dashboard sharing, CDP destination/webhook changes, and project settings are high-risk.

## Capability Mapping

- Read capability: run bounded PostHog reads for projects, events, persons, groups, insights, funnels, dashboards, cohorts, feature flags, experiments, session replays, and CDP destination metadata; summarize without exposing raw identifiers unnecessarily.
- Draft capability: prepare exact PostHog payloads for insight/dashboard edits, cohort changes, feature-flag rollout rules, annotations, or CDP destination/webhook updates without side effects.
- Write capability: create or update selected PostHog insights, dashboards, cohorts, feature flags, annotations, or destinations only inside the authorized project and active approval policy.
- Admin capability: PostHog feature flag rollout changes, cohort membership/rule changes, person/event exports, dashboard public sharing, CDP destination/webhook management, project settings, permissions, billing/admin settings, and destructive operations; disabled by default.
