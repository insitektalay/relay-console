# Reddit Errors And Failure Modes

Provider-specific failure modes:
- Missing permission/scope/product access or access-tier restriction.
- Native account mismatch or wrong target object.
- Rate limit/quota exceeded: Reddit exposes rate-limit information through OAuth response headers such as X-Ratelimit-Used, X-Ratelimit-Remaining, and X-Ratelimit-Reset. Treat 429/403/quarantine/rule errors as stop conditions and avoid fixed universal quota claims.
- Unsupported capability claim, invalid media, invalid visibility/privacy option, or moderation/admin permission failure.
- Policy/community-rule risk: Brigading, spam, karma manipulation, vote automation, subreddit rule violations, wrong community, private-message abuse, moderator overreach, removals/bans without reason, and scraping private data.

Stop and ask for clarification rather than falling back to another account or unsupported endpoint.
