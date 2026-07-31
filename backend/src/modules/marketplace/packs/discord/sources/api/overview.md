# Discord API Overview

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

## Provider Object Model

- applications and application commands/interactions
- guilds/servers, channels and permission overwrites
- messages, threads, reactions and pins
- members, users, roles, bans and timeouts
- incoming webhooks and webhook messages
- Gateway events and privileged intents

## Endpoint Families

- Applications and Interactions: Slash command and interaction changes affect app behavior and require approval.
- Guilds, Members and Roles: Role hierarchy and permissions must be checked before member/admin actions.
- Channels, Threads and Messages: Public posts, mentions and deletes are approval-gated.
- Webhooks: Webhook URLs are secrets and create external posting capability.
- Gateway and Events: Use intents narrowly; privileged intents need explicit justification.
- Moderation: Timeouts, bans, kicks and bulk deletes require approval.
