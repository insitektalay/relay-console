# Discord Webhooks And Events

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

## Provider Events

- Incoming webhooks post messages into one channel by URL and token. Treat the full URL as a secret.
- Webhook Events deliver signed HTTP POSTs for application/user events and must be signature-validated.
- Gateway events require intents; privileged intents expose sensitive data such as message content or member data and must be explicitly enabled.

## Safety Rules

- Creating, changing or deleting webhook subscriptions requires approval.
- Validate signatures/secrets where the provider supports them.
- Redact webhook URLs, signing secrets and delivery payload secrets.
- Dedupe retries and avoid sending private payloads to unapproved external destinations.
