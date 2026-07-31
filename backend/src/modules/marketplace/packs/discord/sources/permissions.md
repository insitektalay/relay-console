# Discord Permissions

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

## Provider Permission Model

- bot
- applications.commands
- identify
- email
- guilds
- guilds.join
- webhook.incoming
- connections
- role_connections.write

## Resource Boundaries

- applications and application commands/interactions
- guilds/servers, channels and permission overwrites
- messages, threads, reactions and pins
- members, users, roles, bans and timeouts
- incoming webhooks and webhook messages
- Gateway events and privileged intents

## Safe Permission Checks

- Confirm read access before exports, uploads, moderation, publishing or webhook changes.
- Confirm the token/user/bot has the exact write/admin capability required by the endpoint.
- Treat missing access and 404 responses as possible permission boundaries, not as a reason to bypass controls.
