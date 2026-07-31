# Slack Webhooks and Events

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

Events API delivers event_callback envelopes for message, app_mention, reaction_added, file_shared, member_joined_channel, app_home_opened, and other subscribed events. Slash commands and interactivity payloads require signature verification. Incoming webhooks are write-only posting URLs and must be treated as secrets.

Verify Slack request signatures and timestamps before accepting Events API, slash command, shortcut, modal, or interactivity payloads. Handle URL verification challenges without side effects. De-duplicate event retries by `event_id` before posting or mutating Slack state.

Webhook/event endpoint creation, event subscription changes, callback URL changes, signing-secret rotation, Socket Mode changes, and deletion require approval and audit.
