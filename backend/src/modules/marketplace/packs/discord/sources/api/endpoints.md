# Discord Endpoints

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

## Representative Endpoints

- GET /users/@me and OAuth2 token endpoints
- GET /guilds/{guild.id}, /guilds/{guild.id}/members, /roles, /bans
- GET/POST/PATCH/DELETE /channels/{channel.id}/messages
- POST /interactions/{interaction.id}/{interaction.token}/callback and followups
- GET/POST/PATCH/DELETE /webhooks/{webhook.id}/{webhook.token}
- Gateway websocket identify/resume and event dispatches

## Method Guidance

- GET/list endpoints are preferred for discovery and summaries.
- POST/PATCH/PUT/DELETE endpoints are side-effecting and must pass capability, permission and approval checks.
- For publish/export/moderation/admin endpoints, include exact target IDs and a rollback or remediation note where the provider supports one.
