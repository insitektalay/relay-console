# Canva Rate Limits

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://www.canva.dev/docs/connect/
- https://www.canva.dev/docs/connect/authentication/
- https://www.canva.dev/docs/connect/appendix/scopes/
- https://www.canva.dev/docs/connect/canva-concepts/
- https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/
- https://www.canva.dev/docs/connect/webhooks/

## Limits And Quotas

- Export jobs have documented integration, document and user throttles; create one job per intended export and poll job status instead of resubmitting.
- Canva APIs return standard HTTP errors and rate-limit responses; back off on throttling and keep idempotency around async jobs.

## Throttling Behavior

- Honor Retry-After and provider rate-limit headers.
- Batch or narrow reads where official APIs support it.
- Prefer webhooks/events over polling when available.
- Never work around limits by rotating user secrets or bypassing provider policy.
