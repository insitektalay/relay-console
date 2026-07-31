# Slack Errors and Failure Modes

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

Slack Web API often returns HTTP 200 with `ok:false` and error values such as `not_in_channel`, `channel_not_found`, `missing_scope`, `invalid_auth`, `account_inactive`, `is_archived`, `msg_too_long`, `not_allowed_token_type`, or `ratelimited`. Stop on scope/auth errors and ask for connection repair.

For `not_in_channel`, do not auto-join or request `chat:write.public` without approval. For `is_archived`, do not unarchive or repost elsewhere without user confirmation. For `msg_too_long`, draft a shorter message or file upload plan rather than truncating silently.

On authentication, authorization, validation, conflict, quota, throttling, provider outage, or partial-write failures: stop, summarize the safe Slack error, preserve channel ids/message timestamps, and do not retry side-effecting writes blindly.
