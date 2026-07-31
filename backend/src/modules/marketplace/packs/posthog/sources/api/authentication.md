# PostHog API Authentication

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

Personal API key or project API key depending on endpoint. Tokens/secrets remain in ClawChat connections.

Use connector-held PostHog personal API keys for management API endpoints and project API keys only where PostHog documents project-key access. Confirm the key can access the requested PostHog project and resource type before selecting endpoints. Do not infer PostHog API keys, project ids, host region, feature-flag keys, person ids, or query filters from user text; if access is insufficient, ask the user to repair the PostHog connection.
