# Discord API Authentication

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

## Authentication Families

- Bot tokens for bot users and most guild/channel/message APIs
- OAuth2 user tokens for user-authorized profile/guild/application flows
- Incoming webhook URLs for one-way posting to a specific channel

## Scopes, Grants And Capabilities

- bot
- applications.commands
- identify
- email
- guilds
- guilds.join
- webhook.incoming
- connections
- role_connections.write

## Secret Safety

- Do not put secrets in generated OpenClaw or Hermes outputs.
- Do not include bearer tokens, API keys, bot tokens, application passwords, webhook URLs with tokens, client secrets or refresh tokens in examples.
- When showing examples, use placeholder IDs and redacted headers.
