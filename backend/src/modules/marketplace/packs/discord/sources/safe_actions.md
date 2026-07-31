# Discord Safe Actions

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

## Allowed Without Additional Approval

- Read accessible resources and summarize state.
- Draft comments, replies, posts, content updates, publishing plans and moderation recommendations.
- Prepare exact API payloads for review without sending them.

## Approval Required

- Post this announcement to #general with @here.
- Give role 456 Manage Messages in guild 789.
- Delete these reported messages or timeout this member.

## Blocked

- Reveal the bot token or webhook URL.
- DM every member of the server.
- Grant Administrator to my role or disable moderation settings.

## Sensitive Risk Areas

- public channel posting and @everyone/@here/large role mentions
- role or permission changes granting admin/mod powers
- moderation actions such as timeout, kick, ban and delete messages
- mass-message/spam behavior
- bot tokens, webhook URLs and interaction tokens
