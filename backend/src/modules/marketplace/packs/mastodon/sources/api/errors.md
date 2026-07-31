# Mastodon Errors And Failure Modes

Provider-specific failure modes:
- Missing permission/scope/product access or access-tier restriction.
- Native account mismatch or wrong target object.
- Rate limit/quota exceeded: Mastodon defaults are instance-enforced and can vary, but official docs list 300 requests per 5 minutes per account and per IP, POST /api/v1/media 30 per 30 minutes, and DELETE /api/v1/statuses/:id or unreblog 30 per 30 minutes. Headers include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset.
- Unsupported capability claim, invalid media, invalid visibility/privacy option, or moderation/admin permission failure.
- Policy/community-rule risk: Federation amplification, public vs unlisted/private/direct visibility mistakes, content warning/sensitive-media omissions, instance rule violations, direct visibility mistaken for encrypted DMs, boosts/favourites as endorsement, and admin moderation overreach.

Stop and ask for clarification rather than falling back to another account or unsupported endpoint.
