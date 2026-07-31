# Pinterest Rate Limits And Quotas

Pinterest documents universal limits: Trial access 1,000 requests per day for all API requests; Standard access 100 requests per second per user per app. Category examples include org_read 1,000 requests/minute standard and org_write 100 requests/minute standard, with trial org_write 300/day. Headers include x-ratelimit-limit, x-ratelimit-remaining, and x-ratelimit-reset.

Operational rules:
- Treat 429, product-tier errors, product-access denial, and quota exhaustion as hard stops.
- Do not split work across tokens/accounts to evade platform limits.
- Record provider response headers/metadata when available and back off rather than retrying blindly.

Official docs:
- https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
- https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/
- https://developers.pinterest.com/docs/reference/rate-limits/
