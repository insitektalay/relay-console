# YouTube Data API Rate Limits

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/youtube/v3/getting-started
- https://developers.google.com/youtube/v3/guides/authentication
- https://developers.google.com/youtube/v3/docs/videos/list
- https://developers.google.com/youtube/v3/docs/errors
- https://developers.google.com/youtube/v3/guides/push_notifications
- https://developers.google.com/youtube/v3/guides/implementation/partial

## Limits And Quotas

- The API uses quota units; every request costs at least 1 unit and write/upload/search operations cost more than simple list calls.
- Use part and fields to reduce payloads, cache with ETags, and avoid quota-heavy polling.
- quotaExceeded is a 403 failure and should stop retries until quota is restored.

## Throttling Behavior

- Honor Retry-After and provider rate-limit headers.
- Batch or narrow reads where official APIs support it.
- Prefer webhooks/events over polling when available.
- Never work around limits by rotating user secrets or bypassing provider policy.
