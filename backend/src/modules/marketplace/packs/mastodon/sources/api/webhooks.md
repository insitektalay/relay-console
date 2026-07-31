# Mastodon Webhooks And Events

Mastodon supports streaming/push-style surfaces depending on instance version/configuration. Use only documented instance-supported streaming or Web Push; otherwise bounded polling.

Rules:
- Use official event/callback/streaming surfaces only when configured and documented for Mastodon.
- Verify signatures or authenticated stream/session context where the provider supports it.
- If the provider does not document an event surface for the requested action, say so and use bounded reads only with approval.

Official docs:
- https://docs.joinmastodon.org/api/oauth-scopes/
- https://docs.joinmastodon.org/methods/statuses/
- https://docs.joinmastodon.org/api/rate-limits/
