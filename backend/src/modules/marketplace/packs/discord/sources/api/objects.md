# Discord Objects

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

## Primary Objects

- applications and application commands/interactions
- guilds/servers, channels and permission overwrites
- messages, threads, reactions and pins
- members, users, roles, bans and timeouts
- incoming webhooks and webhook messages
- Gateway events and privileged intents

## Object-ID Discipline

- Resolve IDs from provider reads before writes.
- Include human-readable names only as context; the request target must be an official provider ID/key.
- Validate ownership/visibility boundaries for private, public, customer-facing and admin resources.
