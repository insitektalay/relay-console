# TikTok Errors And Failure Modes

Provider-specific failure modes:
- Missing permission/scope/product access or access-tier restriction.
- Native account mismatch or wrong target object.
- Rate limit/quota exceeded: TikTok documents a Direct Post daily rate limit of 6 requests per minute and 20 successful posts per day per user for video Direct Post; upload/inbox flows can hit daily upload caps and 429 rate_limit_exceeded. Respect creator_info privacy_level_options.
- Unsupported capability claim, invalid media, invalid visibility/privacy option, or moderation/admin permission failure.
- Policy/community-rule risk: Unaudited-client restrictions, private-mode limits, branded content disclosures, AI-generated content labeling, music/rights, wrong privacy level, mass posting, and unsupported comments/DM automation.

Stop and ask for clarification rather than falling back to another account or unsupported endpoint.
