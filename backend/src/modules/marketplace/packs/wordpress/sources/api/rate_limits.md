# WordPress Rate Limits

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.wordpress.org/rest-api/
- https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/
- https://developer.wordpress.org/rest-api/reference/posts/
- https://developer.wordpress.org/rest-api/reference/pages/
- https://developer.wordpress.org/rest-api/reference/media/
- https://developer.wordpress.org/rest-api/reference/comments/
- https://developer.wordpress.org/rest-api/reference/users/

## Limits And Quotas

- Core WordPress does not publish a single global REST rate limit; hosting, WAF, security plugins or wordpress.com can throttle requests.
- Back off on 429/503 and avoid aggressive polling of posts, media or comments.

## Throttling Behavior

- Honor Retry-After and provider rate-limit headers.
- Batch or narrow reads where official APIs support it.
- Prefer webhooks/events over polling when available.
- Never work around limits by rotating user secrets or bypassing provider policy.
