# Threads Webhooks And Events

Threads event support must be limited to documented Meta/Threads callback surfaces available to the app. If not configured, use bounded polling for owned media/replies only.

Rules:
- Use official event/callback/streaming surfaces only when configured and documented for Threads.
- Verify signatures or authenticated stream/session context where the provider supports it.
- If the provider does not document an event surface for the requested action, say so and use bounded reads only with approval.

Official docs:
- https://developers.facebook.com/docs/threads/
- https://developers.facebook.com/docs/threads/get-started
- https://developers.facebook.com/docs/threads/threads-media
