# LinkedIn Webhooks And Events

Do not claim broad webhooks. Use only LinkedIn products/events documented for the app, otherwise use approved bounded reads.

Rules:
- Use official event/callback/streaming surfaces only when configured and documented for LinkedIn.
- Verify signatures or authenticated stream/session context where the provider supports it.
- If the provider does not document an event surface for the requested action, say so and use bounded reads only with approval.

Official docs:
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version
