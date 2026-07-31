# Mastodon Endpoint Families

## 1. POST /api/v1/statuses creates a status/reply/scheduled status after approval.

## 2. GET /api/v1/statuses/:id reads a status.

## 3. PUT /api/v1/statuses/:id edits a status after approval.

## 4. DELETE /api/v1/statuses/:id deletes a status after approval.

## 5. POST /api/v2/media uploads media; GET /api/v1/timelines/home and GET /api/v1/notifications read context.

Approval rule: do not call write/delete/moderation endpoints until the user has approved exact native account, native object ID, payload, and visibility.

Official docs:
- https://docs.joinmastodon.org/api/oauth-scopes/
- https://docs.joinmastodon.org/methods/statuses/
- https://docs.joinmastodon.org/api/rate-limits/
