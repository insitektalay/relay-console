# Figma Rate Limits

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.figma.com/docs/rest-api/
- https://developers.figma.com/docs/rest-api/authentication/
- https://developers.figma.com/docs/rest-api/scopes/
- https://developers.figma.com/docs/rest-api/file-endpoints/
- https://developers.figma.com/docs/rest-api/webhooks/
- https://developers.figma.com/docs/rest-api/rate-limits/

## Limits And Quotas

- Figma applies endpoint tiers by user seat, plan, resource plan and auth method.
- OAuth is tracked per user, plan and app; personal access tokens are tracked per user and plan.
- 429 responses include Retry-After plus Figma rate-limit headers; wait instead of retrying aggressively.

## Throttling Behavior

- Honor Retry-After and provider rate-limit headers.
- Batch or narrow reads where official APIs support it.
- Prefer webhooks/events over polling when available.
- Never work around limits by rotating user secrets or bypassing provider policy.
