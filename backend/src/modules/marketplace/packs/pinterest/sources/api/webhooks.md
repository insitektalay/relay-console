# Pinterest Webhooks And Events

Pinterest organic API support should be treated as request/response plus bounded polling unless official webhooks are configured for the exact surface. Do not claim DMs or comment automation.

Rules:
- Use official event/callback/streaming surfaces only when configured and documented for Pinterest.
- Verify signatures or authenticated stream/session context where the provider supports it.
- If the provider does not document an event surface for the requested action, say so and use bounded reads only with approval.

Official docs:
- https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
- https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/
- https://developers.pinterest.com/docs/reference/rate-limits/
