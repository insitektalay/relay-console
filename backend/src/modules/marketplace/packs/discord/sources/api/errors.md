# Discord Errors

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.discord.com/developers/platform/oauth2-and-permissions
- https://docs.discord.com/developers/topics/permissions
- https://docs.discord.com/developers/resources/channel
- https://docs.discord.com/developers/resources/guild
- https://docs.discord.com/developers/platform/webhooks
- https://docs.discord.com/developers/topics/rate-limits
- https://docs.discord.com/developers/events/gateway

## Failure Modes

- 401/403 means invalid token, missing bot permission, missing OAuth scope or role hierarchy restriction.
- 429 means route/global rate limit; obey retry_after.
- Missing access or unknown channel/message/guild errors can also indicate the bot is not in the guild or lacks channel visibility.

## Response Discipline

- Stop on auth, permission or ownership failures and ask for corrected access.
- Do not retry destructive or publishing calls blindly.
- Record provider error code/status and redacted request target in the audit summary.
