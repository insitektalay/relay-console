# Bluesky Endpoint Families

## 1. POST /xrpc/com.atproto.server.createSession creates a session and returns accessJwt and refreshJwt.

## 2. POST /xrpc/com.atproto.repo.createRecord creates app.bsky.feed.post records after approval.

## 3. POST /xrpc/com.atproto.repo.deleteRecord deletes a record after approval.

## 4. GET /xrpc/com.atproto.repo.getRecord reads records for strong refs.

## 5. POST /xrpc/com.atproto.repo.uploadBlob uploads images/video blobs before embedding.

Approval rule: do not call write/delete/moderation endpoints until the user has approved exact native account, native object ID, payload, and visibility.

Official docs:
- https://docs.bsky.app/docs/get-started
- https://docs.bsky.app/docs/advanced-guides/posts
- https://docs.bsky.app/docs/advanced-guides/rate-limits
