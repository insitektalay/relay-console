# Mastodon Rate Limits And Quotas

Mastodon defaults are instance-enforced and can vary, but official docs list 300 requests per 5 minutes per account and per IP, POST /api/v1/media 30 per 30 minutes, and DELETE /api/v1/statuses/:id or unreblog 30 per 30 minutes. Headers include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset.

Operational rules:
- Treat 429, product-tier errors, product-access denial, and quota exhaustion as hard stops.
- Do not split work across tokens/accounts to evade platform limits.
- Record provider response headers/metadata when available and back off rather than retrying blindly.

Official docs:
- https://docs.joinmastodon.org/api/oauth-scopes/
- https://docs.joinmastodon.org/methods/statuses/
- https://docs.joinmastodon.org/api/rate-limits/
