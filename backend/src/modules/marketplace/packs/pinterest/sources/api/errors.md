# Pinterest Errors And Failure Modes

Provider-specific failure modes:
- Missing permission/scope/product access or access-tier restriction.
- Native account mismatch or wrong target object.
- Rate limit/quota exceeded: Pinterest documents universal limits: Trial access 1,000 requests per day for all API requests; Standard access 100 requests per second per user per app. Category examples include org_read 1,000 requests/minute standard and org_write 100 requests/minute standard, with trial org_write 300/day. Headers include x-ratelimit-limit, x-ratelimit-remaining, and x-ratelimit-reset.
- Unsupported capability claim, invalid media, invalid visibility/privacy option, or moderation/admin permission failure.
- Policy/community-rule risk: Wrong board/secret board, copyright or affiliate disclosures, spammy duplicate Pins, ads-vs-organic confusion, unapproved board deletion, and private-data export from followers/account analytics.

Stop and ask for clarification rather than falling back to another account or unsupported endpoint.
