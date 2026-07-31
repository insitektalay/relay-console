# TikTok Rate Limits And Quotas

TikTok documents a Direct Post daily rate limit of 6 requests per minute and 20 successful posts per day per user for video Direct Post; upload/inbox flows can hit daily upload caps and 429 rate_limit_exceeded. Respect creator_info privacy_level_options.

Operational rules:
- Treat 429, product-tier errors, product-access denial, and quota exhaustion as hard stops.
- Do not split work across tokens/accounts to evade platform limits.
- Record provider response headers/metadata when available and back off rather than retrying blindly.

Official docs:
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
