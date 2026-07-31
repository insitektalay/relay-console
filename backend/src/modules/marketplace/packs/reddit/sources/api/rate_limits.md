# Reddit Rate Limits And Quotas

Reddit exposes rate-limit information through OAuth response headers such as X-Ratelimit-Used, X-Ratelimit-Remaining, and X-Ratelimit-Reset. Treat 429/403/quarantine/rule errors as stop conditions and avoid fixed universal quota claims.

Operational rules:
- Treat 429, product-tier errors, product-access denial, and quota exhaustion as hard stops.
- Do not split work across tokens/accounts to evade platform limits.
- Record provider response headers/metadata when available and back off rather than retrying blindly.

Official docs:
- https://www.reddit.com/dev/api/
- https://github.com/reddit-archive/reddit/wiki/OAuth2
- https://developers.reddit.com/docs/
