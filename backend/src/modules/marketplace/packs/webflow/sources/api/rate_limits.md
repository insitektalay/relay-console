# Webflow Rate Limits

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.webflow.com/data/reference/authentication
- https://developers.webflow.com/v2.0.0/data/reference/scopes
- https://developers.webflow.com/data/reference/cms/collection-items
- https://developers.webflow.com/data/reference/pages
- https://developers.webflow.com/data/reference/webhooks
- https://developers.webflow.com/data/v2.0.0/reference/rate-limits

## Limits And Quotas

- Webflow enforces Data API rate limits by plan/token context; respect rate-limit headers and back off on 429.
- Avoid polling high-volume CMS or form endpoints when webhooks can cover the workflow.

## Throttling Behavior

- Honor Retry-After and provider rate-limit headers.
- Batch or narrow reads where official APIs support it.
- Prefer webhooks/events over polling when available.
- Never work around limits by rotating user secrets or bypassing provider policy.
