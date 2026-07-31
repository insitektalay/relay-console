# Discord Write Workflows

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

## Write Workflow

1. Read current state and validate target ID, owner/account and required scope.
2. Draft the exact method, endpoint and payload.
3. Check whether the action is allowed, approval-required or blocked.
4. For approval-required actions, wait for explicit human approval that names the target and intended effect.
5. Execute once, then summarize the provider response with secrets redacted.

## Approval-Required Writes

- Post this announcement to #general with @here.
- Give role 456 Manage Messages in guild 789.
- Delete these reported messages or timeout this member.
