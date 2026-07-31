# Discord Workflow Router

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

## Routing Doctrine

1. Confirm the workspace/account, auth type, scopes, target IDs, visibility, and selected approval profile before using provider tools.
2. Prefer reads, summaries and drafts. External posts, public publishing, uploads, deletes, permission changes, webhooks and exports of private/customer content require approval.
3. Resolve provider object IDs from read APIs before constructing writes. Never infer IDs from names alone.
4. Keep secrets in ClawChat connection storage only. Do not print access tokens, refresh tokens, app secrets, API keys, bot tokens or webhook secrets.
5. For approved writes, log target IDs, request intent, human approval reference and a redacted provider response summary.

## Use Discord For

- applications and application commands/interactions
- guilds/servers, channels and permission overwrites
- messages, threads, reactions and pins
- members, users, roles, bans and timeouts
- incoming webhooks and webhook messages
- Gateway events and privileged intents

## Do Not Use Discord For

- Bypassing provider permissions, sharing boundaries or channel/site ownership rules.
- Unrelated CRM, payment, infrastructure or source-control tasks.
- Public publishing or community messaging without explicit approval.
