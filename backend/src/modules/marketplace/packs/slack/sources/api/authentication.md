# Slack API Authentication

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

Slack apps use OAuth 2.0 installation. ClawChat should store bot tokens such as Slack bot-token-shaped values only inside marketplace connections. Socket Mode app-level tokens and signing secrets are operational secrets and must never be rendered. Bot-user operations use Bearer tokens against the Web API; user-token operations require explicit user scopes and should not be assumed.

Use Slack OAuth V2 installation data to bind the connection to the workspace/team, enterprise id where present, bot user id, and installed scopes. Send Web API calls with the Slack Bearer token only through the connector runtime; never ask the user to paste a token into chat.

Use `auth.test` to confirm token validity and workspace context before posting. Treat incoming webhook URLs, signing secrets, and Socket Mode app-level tokens as secrets. On `invalid_auth`, `account_inactive`, `token_revoked`, or `missing_scope`, stop and ask the user to repair or reinstall the Slack connection with the required scopes.
