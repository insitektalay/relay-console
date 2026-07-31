# Slack Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://api.slack.com/web
- https://api.slack.com/authentication/oauth-v2
- https://api.slack.com/scopes
- https://api.slack.com/methods/conversations.history
- https://api.slack.com/methods/conversations.replies
- https://api.slack.com/methods/chat.postMessage
- https://api.slack.com/methods/users.info
- https://api.slack.com/apis/connections/events-api
- https://api.slack.com/apis/rate-limits
- https://api.slack.com/errors

## Authentication Model

Slack apps use OAuth 2.0 installation with requested bot scopes and, only when needed, user scopes. ClawChat should store bot tokens such as Slack bot-token-shaped values only inside marketplace connections, bind them to the installed workspace/team id, and verify the token context with Slack methods such as `auth.test` before writes.

Bot-user operations call Slack Web API methods with a Bearer token and the permissions granted at installation time. User-token operations require explicit user scopes and a clear reason to act as that user; do not silently substitute a user token when a bot token lacks access.

Incoming webhook URLs are write-only posting credentials and must be treated as secrets. Socket Mode app-level tokens and signing secrets are operational secrets used for event delivery and request verification; they must never be rendered, summarized, or copied into Slack messages.

OAuth reinstall or scope expansion is required when Slack returns `missing_scope`, `not_allowed_token_type`, or when a workflow needs a scope such as `chat:write`, `chat:write.public`, `channels:history`, `groups:history`, `files:write`, `reactions:write`, or `users:read.email` that was not granted.

## Secret Safety

- Store provider tokens, API keys, client secrets, refresh tokens, webhook secrets, signing secrets, private keys, and database/payment secrets only in ClawChat connections.
- Never display, summarize, forward, log, or write secret values into generated docs, comments, tickets, messages, files, or tool output.
- If authentication fails, stop and ask the user to repair the connection. Do not request secret values in chat.
