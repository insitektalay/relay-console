# Discord Authentication

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

## Supported Auth Model

- Bot tokens for bot users and most guild/channel/message APIs
- OAuth2 user tokens for user-authorized profile/guild/application flows
- Incoming webhook URLs for one-way posting to a specific channel

## Required Handling

- Store tokens, client secrets, API keys, application passwords and webhook URLs only as ClawChat secrets.
- Redact Authorization headers and secret-bearing URLs from logs and generated docs.
- Verify token owner/account/site/team/guild/channel before using cached IDs.
- If auth fails, debug provider grant, scopes/capabilities, token expiry/revocation and resource-level access.

## Provider Scopes Or Permissions

- bot
- applications.commands
- identify
- email
- guilds
- guilds.join
- webhook.incoming
- connections
- role_connections.write
