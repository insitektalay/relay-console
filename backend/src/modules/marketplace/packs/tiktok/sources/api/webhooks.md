# TikTok Webhooks And Events

Content Posting workflows use status fetch/polling unless the app has documented callback support. Do not invent comment, DM, or moderation webhooks.

Rules:
- Use official event/callback/streaming surfaces only when configured and documented for TikTok.
- Verify signatures or authenticated stream/session context where the provider supports it.
- If the provider does not document an event surface for the requested action, say so and use bounded reads only with approval.

Official docs:
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
