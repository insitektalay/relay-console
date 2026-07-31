# Reddit Webhooks And Events

Classic Reddit API is primarily request/response and polling. Devvit apps have separate event/runtime capabilities; do not conflate Devvit with classic OAuth API endpoints.

Rules:
- Use official event/callback/streaming surfaces only when configured and documented for Reddit.
- Verify signatures or authenticated stream/session context where the provider supports it.
- If the provider does not document an event surface for the requested action, say so and use bounded reads only with approval.

Official docs:
- https://www.reddit.com/dev/api/
- https://github.com/reddit-archive/reddit/wiki/OAuth2
- https://developers.reddit.com/docs/
