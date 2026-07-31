# Bluesky Rate Limits And Quotas

Bluesky documents PDS overall API requests at 3,000 per 5 minutes per IP, createSession at 30 per 5 minutes and 300 per day per account, and content write-operation points per DID of 5,000 per hour and 35,000 per day where CREATE=3, UPDATE=2, DELETE=1. Blob upload max is 52,428,800 bytes at the PDS layer.

Operational rules:
- Treat 429, product-tier errors, product-access denial, and quota exhaustion as hard stops.
- Do not split work across tokens/accounts to evade platform limits.
- Record provider response headers/metadata when available and back off rather than retrying blindly.

Official docs:
- https://docs.bsky.app/docs/get-started
- https://docs.bsky.app/docs/advanced-guides/posts
- https://docs.bsky.app/docs/advanced-guides/rate-limits
