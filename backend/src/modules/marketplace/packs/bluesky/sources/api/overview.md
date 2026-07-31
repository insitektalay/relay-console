# Bluesky API Overview

Auth model: AT Protocol session auth using app passwords or supported OAuth where officially enabled for the client. Resolve handle to DID and PDS before authenticated writes.

Object model: DIDs, handles, PDS repositories, repo records, app.bsky.feed.post records, strong refs with uri/cid, facets for mentions/links/tags, embeds/images/blobs, feeds, profiles, labels, moderation reports.

Endpoint families:
- POST /xrpc/com.atproto.server.createSession creates a session and returns accessJwt and refreshJwt.
- POST /xrpc/com.atproto.repo.createRecord creates app.bsky.feed.post records after approval.
- POST /xrpc/com.atproto.repo.deleteRecord deletes a record after approval.
- GET /xrpc/com.atproto.repo.getRecord reads records for strong refs.
- POST /xrpc/com.atproto.repo.uploadBlob uploads images/video blobs before embedding.

Rate limits/quotas: Bluesky documents PDS overall API requests at 3,000 per 5 minutes per IP, createSession at 30 per 5 minutes and 300 per day per account, and content write-operation points per DID of 5,000 per hour and 35,000 per day where CREATE=3, UPDATE=2, DELETE=1. Blob upload max is 52,428,800 bytes at the PDS layer.

Events/webhooks: Bluesky/AT Protocol uses repo/event streams such as com.atproto.sync.subscribeRepos for firehose-style consumption. Do not claim centralized platform webhook, Page role, or app-review models.

Official docs:
- https://docs.bsky.app/docs/get-started
- https://docs.bsky.app/docs/advanced-guides/posts
- https://docs.bsky.app/docs/advanced-guides/rate-limits
