# Threads Rate Limits And Quotas

Threads API limits are product and endpoint specific. The pack must honor documented response headers, container processing status, and publish limits; do not retry container publish loops without backoff.

Operational rules:
- Treat 429, product-tier errors, product-access denial, and quota exhaustion as hard stops.
- Do not split work across tokens/accounts to evade platform limits.
- Record provider response headers/metadata when available and back off rather than retrying blindly.

Official docs:
- https://developers.facebook.com/docs/threads/
- https://developers.facebook.com/docs/threads/get-started
- https://developers.facebook.com/docs/threads/threads-media
