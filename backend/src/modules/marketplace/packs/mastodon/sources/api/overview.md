# Mastodon API Overview

Auth model: Instance-specific OAuth. Discover/register the app against the target instance, request granular scopes, and validate the account and instance rules before reads or writes.

Object model: Accounts, statuses, timelines, notifications, media attachments, scheduled statuses, favourites, boosts/reblogs, bookmarks, reports, instance rules, federation-visible URLs.

Endpoint families:
- POST /api/v1/statuses creates a status/reply/scheduled status after approval.
- GET /api/v1/statuses/:id reads a status.
- PUT /api/v1/statuses/:id edits a status after approval.
- DELETE /api/v1/statuses/:id deletes a status after approval.
- POST /api/v2/media uploads media; GET /api/v1/timelines/home and GET /api/v1/notifications read context.

Rate limits/quotas: Mastodon defaults are instance-enforced and can vary, but official docs list 300 requests per 5 minutes per account and per IP, POST /api/v1/media 30 per 30 minutes, and DELETE /api/v1/statuses/:id or unreblog 30 per 30 minutes. Headers include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset.

Events/webhooks: Mastodon supports streaming/push-style surfaces depending on instance version/configuration. Use only documented instance-supported streaming or Web Push; otherwise bounded polling.

Official docs:
- https://docs.joinmastodon.org/api/oauth-scopes/
- https://docs.joinmastodon.org/methods/statuses/
- https://docs.joinmastodon.org/api/rate-limits/
