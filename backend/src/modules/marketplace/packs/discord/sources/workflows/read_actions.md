# Discord Read Workflows

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

## Read Workflow

1. Confirm connection, scope and resource boundary.
2. Resolve target IDs from official endpoints.
3. Fetch only fields/items needed for the user request.
4. Summarize state without exposing secrets or unnecessary personal/private content.

## Good Read Requests

- Summarize the last 50 messages in channel 123 without posting.
- Draft a reply for the support thread and wait for approval before sending.
- List roles and permission overwrites that allow Manage Webhooks.
