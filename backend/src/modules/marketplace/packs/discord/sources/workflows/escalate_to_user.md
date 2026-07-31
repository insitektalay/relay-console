# Discord Escalation Workflow

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

## Escalate When

- The request would publish externally, export private/customer content, upload/replace media, delete content, moderate users/comments, change permissions/roles/settings/domains/webhooks, or send public/community messages.
- The provider returns auth/permission failures that require account owner action.
- The requested action matches a blocked item.

## Escalation Payload

- Provider: Discord
- Target IDs and readable names
- Requested endpoint/method family
- Public/private/customer-facing impact
- Required scopes/permissions
- Rollback/remediation notes where available
