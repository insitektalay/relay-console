# PostHog Rate Limits and Quotas

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

PostHog documents API rate limits; use bounded queries

Use cursor/page tokens, field selection, bounded time windows, request batching only where documented, and provider retry headers. Do not fan out writes across large object sets without approval.
