# Slack Rate Limits and Quotas

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

Slack Web API methods are rate limited per method, workspace, app, and token with tiers documented by Slack. Handle HTTP 429 and `Retry-After` exactly, avoid tight polling of `conversations.history`, paginate with cursors, and avoid retrying write methods without idempotent workflow context.

Use cursor pagination, bounded `oldest`/`latest` windows, small channel/member batches, and provider retry headers. Do not fan out `chat.postMessage`, `reactions.add`, file uploads, or channel membership changes across large object sets without approval.

Events API delivery and interactivity retries can produce duplicate payloads. De-duplicate by Slack `event_id`, request timestamp/signature, callback id, or approved workflow id before performing side effects.
