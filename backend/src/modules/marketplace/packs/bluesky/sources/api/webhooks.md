# Bluesky Webhooks And Events

Bluesky/AT Protocol uses repo/event streams such as com.atproto.sync.subscribeRepos for firehose-style consumption. Do not claim centralized platform webhook, Page role, or app-review models.

Rules:
- Use official event/callback/streaming surfaces only when configured and documented for Bluesky.
- Verify signatures or authenticated stream/session context where the provider supports it.
- If the provider does not document an event surface for the requested action, say so and use bounded reads only with approval.

Official docs:
- https://docs.bsky.app/docs/get-started
- https://docs.bsky.app/docs/advanced-guides/posts
- https://docs.bsky.app/docs/advanced-guides/rate-limits
