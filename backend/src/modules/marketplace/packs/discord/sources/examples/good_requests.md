# Discord Good Request Examples

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

## Good Requests

- Summarize the last 50 messages in channel 123 without posting.
- Draft a reply for the support thread and wait for approval before sending.
- List roles and permission overwrites that allow Manage Webhooks.

## Why These Are Good

- They identify a bounded target.
- They favor reads, summaries or drafts.
- They do not expose secrets or create unapproved external side effects.
